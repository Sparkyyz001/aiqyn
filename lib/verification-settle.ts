import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { slaDueAfterReopen } from "@/lib/sla";
import { decide } from "@/lib/verification";
import { recomputeReport, logEvent } from "@/lib/report-engine";
import { recomputeClustersAround } from "@/lib/clustering-db";
import { addReputation, voteWeight } from "@/lib/reputation";

// Не server action: итог голосования подводит только сервер (после голоса и при открытии карточки).
// В файле "use server" любая экспортированная функция доступна из браузера — сюда ей нельзя.
/** Подводит итог голосования (после каждого голоса и лениво при открытии карточки) */
export async function settleVerification(reportId: number): Promise<string> {
  const db = createAdminClient();
  const { data: r } = await db
    .from("reports")
    .select("id, author_id, status, reopen_count, verification_due_at, sla_due_at, service_id, public_no")
    .eq("id", reportId)
    .single();
  if (!r || r.status !== "awaiting_confirmation") return "noop";

  const [{ data: conf }, { data: votes }, { data: profs }] = await Promise.all([
    db.from("report_confirmations").select("user_id, weight").eq("report_id", r.id),
    db.from("report_verifications").select("user_id, verdict, weight").eq("report_id", r.id).eq("round", r.reopen_count),
    r.author_id ? db.from("profiles").select("id, reputation").eq("id", r.author_id) : Promise.resolve({ data: [] }),
  ]);
  const voters = [
    ...(r.author_id ? [{ user_id: r.author_id, weight: voteWeight(Number(profs?.[0]?.reputation ?? 1)), isAuthor: true }] : []),
    ...(conf ?? []).map((c) => ({ user_id: c.user_id, weight: Number(c.weight), isAuthor: false })),
  ];
  const expired = !!r.verification_due_at && new Date(r.verification_due_at) < new Date();
  const d = decide(voters, (votes ?? []).map((v) => ({ ...v, weight: Number(v.weight) })), expired);
  if (d.outcome === "pending") return "pending";

  const now = new Date();
  if (d.outcome === "resolved") {
    await db.from("reports").update({ status: "resolved", resolved_at: now.toISOString(), closed_at: now.toISOString() }).eq("id", r.id);
    await logEvent({
      report_id: r.id, actor_id: null, type: "status_change", from_status: "awaiting_confirmation", to_status: "resolved",
      comment: expired && d.fixed === 0 ? "Окно 72 ч истекло без возражений" : "Жители подтвердили выполнение",
      meta: { ...d, msg: expired && d.fixed === 0 ? "vote_expired" : "vote_fixed" },
    });
    await addReputation(r.author_id, "resolved", r.id, { no: r.public_no });
    for (const c of conf ?? []) await addReputation(c.user_id, "helped", r.id, { no: r.public_no });
  } else {
    const newDue = slaDueAfterReopen(new Date(r.sla_due_at ?? now), now);
    await db
      .from("reports")
      .update({ status: "reopened", reopen_count: r.reopen_count + 1, sla_due_at: newDue.toISOString(), verification_due_at: null })
      .eq("id", r.id);
    await logEvent({
      report_id: r.id, actor_id: null, type: "reopened", from_status: "awaiting_confirmation", to_status: "reopened",
      comment: "Жители сообщили: не сделано. Обращение переоткрыто", meta: { ...d, msg: "vote_not_fixed", new_sla_due_at: newDue.toISOString() },
    });
  }
  await recomputeClustersAround(r.id);
  await recomputeReport(r.id);
  revalidatePath("/service");
  return d.outcome;
}
