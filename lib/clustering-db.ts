import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbscan } from "@/lib/clustering";
import { nearestAddress } from "@/lib/address";
import { districtAt, getReference } from "@/lib/reference";

// Пересчёт системных узлов категории в БД. Объём — сотни обращений, поэтому
// пересчитываем категорию целиком: удалить узлы → DBSCAN → вставить → проставить cluster_id.
export async function recomputeClusters(categoryId: number) {
  const db = createAdminClient();
  const ref = await getReference();
  const since = new Date(Date.now() - 365 * 86400_000).toISOString();
  const { data: rows } = await db
    .from("reports")
    .select("id, lat, lng, created_at, reopen_count, sla_breached_at, status")
    .eq("category_id", categoryId)
    .neq("status", "rejected")
    .eq("is_synthetic", false)
    .gte("created_at", since);
  const points = (rows ?? []).map((r) => ({ ...r, breached: !!r.sla_breached_at }));
  const clusters = dbscan(points);

  await db.from("reports").update({ cluster_id: null }).eq("category_id", categoryId).not("cluster_id", "is", null);
  await db.from("clusters").delete().eq("category_id", categoryId);

  for (const c of clusters) {
    const addr = nearestAddress(c.center);
    const district = districtAt(c.center, ref.districts);
    const { data: ins } = await db
      .from("clusters")
      .insert({
        category_id: categoryId,
        district_id: district?.id ?? null,
        center_lat: c.center.lat,
        center_lng: c.center.lng,
        radius_m: c.radius_m,
        reports_count: c.members.length,
        reopen_total: c.reopen_total,
        first_seen: c.first_seen,
        last_seen: c.last_seen,
        chronic_score: c.chronic_score,
        label: addr?.label ?? district?.name_ru ?? null,
      })
      .select("id")
      .single();
    if (ins) await db.from("reports").update({ cluster_id: ins.id }).in("id", c.members.map((m) => m.id));
  }
  return clusters.length;
}

export async function recomputeClustersAround(reportId: number) {
  const db = createAdminClient();
  const { data } = await db.from("reports").select("category_id").eq("id", reportId).single();
  if (data) await recomputeClusters(data.category_id);
}
