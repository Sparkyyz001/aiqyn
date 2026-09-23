import "server-only";
import { flow } from "@/lib/data";
import { getReference } from "@/lib/reference";
import { flowClusters } from "@/lib/flow-clusters";
import { painIndex, painDelta, type PainRow } from "@/lib/pain-index";
import { createAdminClient } from "@/lib/supabase/admin";

// Индекс боли по текущему потоку (подложка + реальные обращения) и всё, что нужно для экранов.
export async function painData() {
  const [{ all }, ref] = await Promise.all([flow(), getReference()]);
  const districts = ref.districts.filter((d) => d.kind !== "zone").map((d) => ({ code: d.code, population: d.population }));
  const rows = painIndex(all, districts);
  const delta = painDelta(all, districts);
  // Хронические точки (узлы с хроничностью ≥ 0.5) по районам — «что тянет индекс вверх»
  const clusters = flowClusters(all).filter((c) => c.chronic_score >= 0.5);
  const chronicBy = new Map<string, number>();
  for (const c of clusters) if (c.district) chronicBy.set(c.district, (chronicBy.get(c.district) ?? 0) + 1);
  return { all, rows, delta, clusters, chronicBy, ref };
}

/** Снимок индекса на дату в pain_index_history (upsert по району и дате) */
export async function snapshotPain(rows: PainRow[], date: string) {
  const ref = await getReference();
  const idByCode = new Map(ref.districts.map((d) => [d.code, d.id]));
  const payload = rows
    .filter((r) => idByCode.has(r.district))
    .map((r) => ({
      district_id: idByCode.get(r.district)!,
      value: r.index,
      breakdown: { raw: r.raw, groups: r.breakdown, open: r.open, breached: r.breached, reopened: r.reopened, reports90: r.reports90 },
      computed_at: date,
    }));
  const { error } = await createAdminClient().from("pain_index_history").upsert(payload, { onConflict: "district_id,computed_at" });
  if (error) throw new Error(error.message);
  return payload.length;
}
