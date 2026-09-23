import { flow } from "@/lib/data";
import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { roadRisk } from "@/lib/road-risk";
import { CityMap } from "@/components/map/map";
import { createAdminClient } from "@/lib/supabase/admin";
import daily from "@/data/weather_daily.json";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.akimat.nav.forecast };
}

type Seg = { osm_id: string; name: string | null; highway: string; geometry: { coordinates: [number, number][] } };

// Переходы через 0 °C за последний холодный сезон (ноябрь–март) по Open-Meteo
function lastWinterFreezeThaw() {
  const items = daily.items as { date: string; tmin: number; tmax: number }[];
  const lastDate = items[items.length - 1].date;
  const y = Number(lastDate.slice(0, 4)) - (Number(lastDate.slice(5, 7)) >= 11 ? 0 : 1);
  return items.filter((d) => d.date >= `${y}-11-01` && d.date <= `${y + 1}-03-31` && d.tmin < 0 && d.tmax > 0).length;
}

export default async function ForecastPage() {
  const [{ t }, { all }] = await Promise.all([getDict(), flow()]);
  // 838 значимых сегментов (именованные + primary…tertiary) залиты seed-скриптом из OSM
  const { data } = await createAdminClient().from("road_segments").select("osm_id, name, highway_class, geometry").limit(2000);
  const segs: Seg[] = (data ?? []).map((r) => ({ osm_id: r.osm_id, name: r.name, highway: r.highway_class, geometry: r.geometry }));
  const complaints = all.filter((r) => ["road_pit", "excavation"].includes(r.category) && Date.now() - new Date(r.created_at).getTime() < 90 * 86400_000);
  const ft = lastWinterFreezeThaw();
  const ranked = roadRisk(segs, complaints, ft);
  const top = ranked.slice(0, 20);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{t.akimat.forecast.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {tf(t.akimat.forecast.intro, { n: segs.length, ft })}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <CityMap
          className="h-[420px] w-full"
          polygons={top.map((s) => ({
            geojson: { type: "LineString", coordinates: s.coords } as GeoJSON.LineString,
            color: s.risk >= 0.8 ? "#d0452f" : "#d69a1b",
            label: tf(t.akimat.forecast.popup, { name: s.name ?? s.highway, r: s.risk }),
          }))}
        />
      </div>
      <section className="overflow-x-auto rounded-lg border">
        <h2 className="border-b px-4 py-2.5 font-medium">{t.akimat.forecast.top}</h2>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2 font-normal">{t.akimat.forecast.segment}</th>
              <th className="px-2 py-2 font-normal">{t.akimat.forecast.class}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.forecast.length}</th>
              <th className="px-2 py-2 text-right font-normal">{t.akimat.forecast.complaints}</th>
              <th className="px-4 py-2 text-right font-normal">{t.akimat.forecast.risk}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {top.map((s) => (
              <tr key={s.osm_id}>
                <td className="px-4 py-2">
                  <a className="text-primary hover:underline" href={`https://www.openstreetmap.org/${s.osm_id}`} target="_blank" rel="noopener noreferrer">
                    {s.name ?? t.akimat.forecast.unnamed}
                  </a>
                </td>
                <td className="px-2 py-2 text-muted-foreground">{s.highway}</td>
                <td className="px-2 py-2 text-right tabular-nums">{s.km}</td>
                <td className="px-2 py-2 text-right tabular-nums">{s.complaints}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{s.risk.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
