"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildEscalationPayload } from "@/lib/escalation";
import { logEvent } from "@/lib/report-engine";
import { checkEscalation } from "@/lib/escalation-access";

export async function createEscalation(reportId: number, applicant: { full_name: string; contact: string }) {
  const chk = await checkEscalation(reportId);
  if (!chk.ok) return chk;
  if (!applicant.full_name?.trim()) return { ok: false as const, error: "Укажите ФИО заявителя" };
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const payload = await buildEscalationPayload(reportId, { full_name: applicant.full_name.trim(), contact: applicant.contact?.trim() || null }, origin);
  if (!payload) return { ok: false as const, error: "Не удалось собрать пакет" };

  const db = createAdminClient();
  const { data, error } = await db.from("escalations").insert({ report_id: reportId, created_by: chk.me.id, payload }).select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Ошибка" };
  await logEvent({ report_id: reportId, actor_id: chk.me.id, type: "escalated", comment: "Сформирован пакет для eOtinish", meta: { escalation_id: data.id } });
  revalidatePath(`/report/${chk.r.public_no}`);
  return { ok: true as const, data: { id: data.id } };
}

/** Житель вернулся с eotinish.kz и вписал номер своего обращения */
export async function saveEotinishRef(escalationId: number, ref: string) {
  const me = await getProfile();
  if (!me) return { ok: false as const, error: "Нужно войти" };
  const db = createAdminClient();
  const { data: e } = await db.from("escalations").select("id, created_by, report_id").eq("id", escalationId).single();
  if (!e || e.created_by !== me.id) return { ok: false as const, error: "Нет доступа" };
  await db.from("escalations").update({ eotinish_ref: ref.trim(), submitted_at: new Date().toISOString() }).eq("id", e.id);
  await logEvent({ report_id: e.report_id, actor_id: me.id, type: "escalated", comment: `Подано в eOtinish, № ${ref.trim()}` });
  return { ok: true as const };
}
