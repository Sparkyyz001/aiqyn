import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { demoBaseline, type BaseReport } from "@/lib/demo-baseline";

// Единый поток для статистики и карт: [...ДЕМО-ПОДЛОЖКА, ...реальные обращения из БД].
// Дашборд никогда не пуст, а обращение, созданное на демо, сразу двигает цифры (ТЗ, раздел 11).

export type FlowReport = BaseReport;

export async function realReports(): Promise<FlowReport[]> {
  const db = createAdminClient();
  const ref = await getReference();
  const { data } = await db
    .from("reports")
    .select(
      "id, public_no, category_id, service_id, district_id, title, lat, lng, status, created_at, accepted_at, resolved_at, sla_due_at, sla_breached_at, reopen_count, confirmations_count, priority_score, source, report_photos(kind, geo_verified), service_replies(boilerplate_score)"
    )
    .order("created_at", { ascending: false })
    .limit(2000);
  const now = Date.now();
  return (data ?? []).map((r) => {
    const after = (r.report_photos ?? []).filter((p: { kind: string }) => p.kind === "after");
    const replies = (r.service_replies ?? []) as { boilerplate_score: number | null }[];
    const open = !["resolved", "rejected"].includes(r.status);
    return {
      id: r.id,
      public_no: r.public_no,
      demo: false,
      category: ref.categoryById.get(r.category_id)?.code ?? "other",
      service: r.service_id ? ref.serviceById.get(r.service_id)?.code ?? "akimat" : "akimat",
      district: r.district_id ? ref.districtById.get(r.district_id)?.code ?? null : null,
      title: r.title,
      lat: r.lat,
      lng: r.lng,
      status: r.status,
      created_at: r.created_at,
      accepted_at: r.accepted_at,
      resolved_at: r.resolved_at,
      sla_due_at: r.sla_due_at,
      sla_breached: !!r.sla_breached_at || (open && !!r.sla_due_at && new Date(r.sla_due_at).getTime() < now),
      reopen_count: r.reopen_count,
      confirmations: r.confirmations_count,
      priority: r.priority_score,
      after_geo_verified: after.length ? after.some((p: { geo_verified: boolean }) => p.geo_verified) : null,
      reply_boilerplate: replies.length ? Math.max(...replies.map((x) => x.boilerplate_score ?? 0)) : null,
      source: r.source,
    };
  });
}

export async function flow(): Promise<{ all: FlowReport[]; real: FlowReport[] }> {
  const real = await realReports();
  return { all: [...real, ...demoBaseline()], real };
}

/** Облегчённые точки для карты (на клиент уходит только необходимое) */
export type MapPoint = {
  id: number; no: string; c: string; s: string; lat: number; lng: number;
  t: string; d: string | null; b: boolean; demo: boolean; at: string;
};
export const toMapPoint = (r: FlowReport): MapPoint => ({
  id: r.id, no: r.public_no, c: r.category, s: r.status, lat: r.lat, lng: r.lng,
  t: r.title, d: r.district, b: r.sla_breached, demo: r.demo, at: r.created_at,
});
