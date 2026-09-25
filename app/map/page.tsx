import { getDict } from "@/lib/i18n/server";
import { toMapPoint } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { flowClusters } from "@/lib/flow-clusters";
import { painData, painChoropleth } from "@/lib/pain-data";
import { DISTRICT, nm } from "@/lib/meta";
import { LiveRefresh } from "@/components/live-refresh";
import { MapExplorer } from "./map-explorer";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.map.title };
}

export default async function MapPage() {
  // все источники — параллельно: словарь, поток с индексом боли, активные аварии
  const [{ lang, t }, { all, rows, polygons }, { data: incidents }] = await Promise.all([
    getDict(),
    painData(),
    createAdminClient().from("incidents").select("id, title, polygon, eta_at, type").eq("status", "active"),
  ]);

  // сводка по району — для панели при выборе микрорайона
  const districtInfo = Object.fromEntries(
    rows.map((r) => [
      r.district,
      { index: r.index, open: r.open, breached: r.breached, reports90: r.reports90, insufficient: r.insufficient, geojson: polygons.get(r.district) ?? null },
    ])
  );
  // на клиент уходят только поля, нужные карте
  const clusters = flowClusters(all).map(({ category, lat, lng, radius_m, count, chronic_score, label }) => ({ category, lat, lng, radius_m, count, chronic_score, label }));

  return (
    <>
      <LiveRefresh />
      <MapExplorer
        points={all.map((r) => toMapPoint(r, lang))}
        clusters={clusters}
        choropleth={painChoropleth(rows, polygons, (r) => `${nm(DISTRICT[r.district], lang)} · ${t.pain.short}: ${r.index ?? t.pain.insufficient}`, false)}
        districtInfo={districtInfo}
        incidents={incidents ?? []}
        lang={lang}
        t={{ map: t.map, status: t.status, nav: t.nav, pain: t.pain, outcome: t.outcome }}
      />
    </>
  );
}
