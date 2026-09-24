import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";

// Открытый API: реальные обращения без персональных данных (ни автора, ни фото заявителя).
// GET /api/public/v1/reports?status=open&category=road_pit&district=mkr-3&since=2026-09-01&limit=100&format=geojson

const OPEN = ["new", "routed", "accepted", "in_progress", "awaiting_confirmation", "reopened"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = await getReference();
  const db = createAdminClient();
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? 200)));
  let q = db
    .from("reports")
    .select("public_no, category_id, service_id, district_id, title, lat, lng, status, created_at, accepted_at, resolved_at, sla_due_at, sla_breached_at, reopen_count, confirmations_count, priority_score, source")
    .eq("is_synthetic", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  const status = url.searchParams.get("status");
  if (status === "open") q = q.in("status", OPEN);
  else if (status) q = q.eq("status", status);
  const cat = url.searchParams.get("category");
  if (cat) q = q.eq("category_id", ref.categoryByCode.get(cat)?.id ?? -1);
  const dist = url.searchParams.get("district");
  if (dist) q = q.eq("district_id", ref.districts.find((d) => d.code === dist)?.id ?? -1);
  const since = url.searchParams.get("since");
  if (since) q = q.gte("created_at", since);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 400 });

  const items = (data ?? []).map((r) => ({
    id: r.public_no,
    url: `${url.origin}/report/${r.public_no}`,
    category: ref.categoryById.get(r.category_id)?.code,
    service: r.service_id ? ref.serviceById.get(r.service_id)?.code : null,
    district: r.district_id ? ref.districtById.get(r.district_id)?.code : null,
    title: r.title,
    lat: r.lat,
    lng: r.lng,
    status: r.status,
    created_at: r.created_at,
    accepted_at: r.accepted_at,
    resolved_at: r.resolved_at,
    sla_due_at: r.sla_due_at,
    sla_breached: !!r.sla_breached_at,
    reopen_count: r.reopen_count,
    confirmations: r.confirmations_count,
    priority: r.priority_score,
    source: r.source,
  }));

  const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
  if (url.searchParams.get("format") === "geojson") {
    return Response.json(
      {
        type: "FeatureCollection",
        features: items.map(({ lat, lng, ...p }) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: p })),
      },
      { headers }
    );
  }
  return Response.json({ count: items.length, license: "CC BY 4.0", items }, { headers });
}
