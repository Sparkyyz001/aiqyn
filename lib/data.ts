import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { REPORTS_TAG } from "@/lib/cache-tags";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import type { BaseReport } from "@/lib/demo-baseline";

// Единый поток для статистики и карт — всё из базы: реальные обращения и модельный поток
// (is_synthetic = true, номера AQ-2026-9xxxx). Дашборд никогда не пуст, а обращение,
// созданное на демо, сразу двигает цифры (ТЗ, раздел 11).

export type FlowReport = BaseReport;

// Сырые строки из базы — в серверном кеше на 30 с; любое изменение обращения сбрасывает
// кеш сразу (touchReports в logEvent), поэтому свежая жалоба видна без задержки.
const fetchRows = unstable_cache(
  async () => {
    const { data, error } = await createAdminClient()
      .from("reports")
      .select(
        "id, public_no, is_synthetic, synthetic, category_id, service_id, district_id, title, title_kz, lat, lng, status, created_at, accepted_at, resolved_at, sla_due_at, sla_breached_at, reopen_count, confirmations_count, priority_score, source, report_photos(kind, geo_verified), service_replies(boilerplate_score)"
      )
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message); // ошибку не кешируем
    return data ?? [];
  },
  ["reports-flow-v1"],
  { revalidate: 30, tags: [REPORTS_TAG] }
);

// один разбор на рендер, даже если поток нужен нескольким блокам страницы
export const realReports = cache(async (): Promise<FlowReport[]> => {
  const [ref, data] = await Promise.all([getReference(), fetchRows()]);
  const now = Date.now();
  return (data ?? []).map((r) => {
    const after = (r.report_photos ?? []).filter((p: { kind: string }) => p.kind === "after");
    const replies = (r.service_replies ?? []) as { boilerplate_score: number | null }[];
    const open = !["resolved", "rejected"].includes(r.status);
    const syn = r.is_synthetic ? ((r.synthetic ?? {}) as { after_geo_verified?: boolean | null; reply_boilerplate?: number | null }) : null;
    return {
      id: r.id,
      public_no: r.public_no,
      demo: !!r.is_synthetic,
      category: ref.categoryById.get(r.category_id)?.code ?? "other",
      service: r.service_id ? ref.serviceById.get(r.service_id)?.code ?? "akimat" : "akimat",
      district: r.district_id ? ref.districtById.get(r.district_id)?.code ?? null : null,
      title: r.title,
      title_kz: r.title_kz ?? null,
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
      after_geo_verified: syn ? syn.after_geo_verified ?? null : after.length ? after.some((p: { geo_verified: boolean }) => p.geo_verified) : null,
      reply_boilerplate: syn ? syn.reply_boilerplate ?? null : replies.length ? Math.max(...replies.map((x) => x.boilerplate_score ?? 0)) : null,
      source: r.source,
    };
  });
});

export async function flow(): Promise<{ all: FlowReport[]; real: FlowReport[] }> {
  const all = await realReports();
  return { all, real: all.filter((r) => !r.demo) };
}

/** Облегчённые точки для карты (на клиент уходит только необходимое) */
export type MapPoint = {
  id: number; no: string; c: string; s: string; lat: number; lng: number;
  t: string; d: string | null; b: boolean; demo: boolean; at: string;
  sv: string; res: string | null; cf: number;
};
/** Заголовок в нужной локали: у демо-записей есть казахский вариант, тексты жителей показываем как написаны */
export const titleOf = (r: { title: string; title_kz: string | null }, lang: "ru" | "kz") => (lang === "kz" && r.title_kz ? r.title_kz : r.title);

export const toMapPoint = (r: FlowReport, lang: "ru" | "kz" = "ru"): MapPoint => ({
  id: r.id, no: r.public_no, c: r.category, s: r.status, lat: r.lat, lng: r.lng,
  t: titleOf(r, lang), d: r.district, b: r.sla_breached, demo: r.demo, at: r.created_at,
  sv: r.service, res: r.resolved_at, cf: r.confirmations,
});
