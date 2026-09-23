import { getDict } from "@/lib/i18n/server";
import { flow, toMapPoint } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { flowClusters } from "@/lib/flow-clusters";
import { LiveRefresh } from "@/components/live-refresh";
import { MapExplorer } from "./map-explorer";

export const metadata = { title: "Карта обращений" };

export default async function MapPage() {
  const [{ lang, t }, { all }] = await Promise.all([getDict(), flow()]);
  const db = createAdminClient();
  const { data: incidents } = await db.from("incidents").select("id, title, polygon, eta_at, type").eq("status", "active");
  const clusters = flowClusters(all).map((c) => ({
    category: c.category, lat: c.lat, lng: c.lng, radius_m: c.radius_m, count: c.count, chronic_score: c.chronic_score, label: c.label,
  }));
  return (
    <>
      <LiveRefresh />
      <MapExplorer
        points={all.map(toMapPoint)}
        clusters={clusters}
        incidents={incidents ?? []}
        lang={lang}
        t={{ map: t.map, status: t.status, nav: t.nav }}
      />
    </>
  );
}
