import { getDict } from "@/lib/i18n/server";
import { flow, toMapPoint } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { flowClusters } from "@/lib/flow-clusters";
import { painData } from "@/lib/pain-data";
import { DISTRICT, nm } from "@/lib/meta";
import { LiveRefresh } from "@/components/live-refresh";
import { MapExplorer } from "./map-explorer";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.map.title };
}

export default async function MapPage() {
  const [{ lang, t }, { all }, pain] = await Promise.all([getDict(), flow(), painData()]);
  const polyBy = new Map(pain.ref.districts.map((d) => [d.code, d.polygon]));
  const choropleth = pain.rows
    .filter((r) => polyBy.get(r.district))
    .map((r) => ({
      geojson: polyBy.get(r.district) as unknown as GeoJSON.GeoJsonObject,
      index: r.index,
      label: `${nm(DISTRICT[r.district], lang)} · ${t.pain.short}: ${r.index ?? t.pain.insufficient}`,
    }));
  const db = createAdminClient();
  const { data: incidents } = await db.from("incidents").select("id, title, polygon, eta_at, type").eq("status", "active");
  const clusters = flowClusters(all).map((c) => ({
    category: c.category, lat: c.lat, lng: c.lng, radius_m: c.radius_m, count: c.count, chronic_score: c.chronic_score, label: c.label,
  }));
  return (
    <>
      <LiveRefresh />
      <MapExplorer
        points={all.map((r) => toMapPoint(r, lang))}
        clusters={clusters}
        choropleth={choropleth}
        incidents={incidents ?? []}
        lang={lang}
        t={{ map: t.map, status: t.status, nav: t.nav, pain: t.pain }}
      />
    </>
  );
}
