import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference, nearestSocial } from "@/lib/reference";
import { computePriority } from "@/lib/priority";

// Пересчёт производных полей обращения: приоритет и отметка о нарушении SLA.
// Вызывается сервером после любого изменения (подтверждение, статус, переоткрытие).
export async function recomputeReport(reportId: number) {
  const db = createAdminClient();
  const ref = await getReference();
  const { data: r } = await db
    .from("reports")
    .select("id, category_id, lat, lng, status, created_at, sla_due_at, sla_breached_at, reopen_count, cluster_id, priority_score")
    .eq("id", reportId)
    .single();
  if (!r) return;

  const cat = ref.categoryById.get(r.category_id)!;
  const [{ data: conf }, { data: cluster }] = await Promise.all([
    db.from("report_confirmations").select("weight").eq("report_id", r.id),
    r.cluster_id
      ? db.from("clusters").select("chronic_score").eq("id", r.cluster_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const now = new Date();
  const closed = r.status === "resolved" || r.status === "rejected";
  const due = r.sla_due_at ? new Date(r.sla_due_at) : null;
  const breachedNow = !closed && !!due && due < now;
  const slaBreachedAt = r.sla_breached_at ?? (breachedNow ? due!.toISOString() : null);

  const { score } = computePriority({
    severityBase: cat.severity_base,
    confirmationWeights: (conf ?? []).reduce((s, c) => s + Number(c.weight), 0),
    daysInQueue: (now.getTime() - new Date(r.created_at).getTime()) / 86400_000,
    slaDays: cat.sla_days,
    nearSocial: !!nearestSocial(r),
    slaBreached: !!slaBreachedAt,
    chronicScore: cluster?.chronic_score ?? 0,
    reopenCount: r.reopen_count,
  });

  // Пишем только при заметном изменении: иначе каждое открытие очереди порождало бы
  // Realtime-событие → обновление страницы → пересчёт → событие… (петля)
  if (Math.abs(score - r.priority_score) < 0.5 && slaBreachedAt === r.sla_breached_at) return;
  await db.from("reports").update({ priority_score: score, sla_breached_at: slaBreachedAt }).eq("id", r.id);
}

/** Запись в хронологию — доказательная база для эскалации (ТЗ, 6.6) */
export async function logEvent(e: {
  report_id: number;
  actor_id: string | null;
  type: string;
  from_status?: string | null;
  to_status?: string | null;
  comment?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  const db = createAdminClient();
  await db.from("report_events").insert(e);
  // уведомления — вторично: их сбой не должен ломать подачу или смену статуса
  try {
    const { notifyEvent } = await import("@/lib/notify");
    await notifyEvent(e);
  } catch (err) {
    console.error("notify", err);
  }
}
