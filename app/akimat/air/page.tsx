import { flow } from "@/lib/data";
import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { backtrace, overlaps, SECTOR_DEG, MAX_DIST_M, CELL_M, type WindObs } from "@/lib/wind";
import { AKTAU_CENTER, type GeoPolygon } from "@/lib/geo";
import { CityMap } from "@/components/map/map";
import weather from "@/data/weather_history.json";
import industrial from "@/data/industrial.json";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.akimat.nav.air };
}

// Почасовой ветер Open-Meteo (время в data — местное Asia/Aqtau, UTC+5)
const OBS: WindObs[] = (weather.items as { t: string; wind_deg: number; wind_speed: number }[])
  .map((w) => ({ t: new Date(w.t + ":00+05:00").getTime(), deg: w.wind_deg, speed: w.wind_speed }))
  .sort((a, b) => a.t - b.t);

type Obj = { name: string | null; kind: string | null; polygon: GeoPolygon | null; lat: number; lng: number };

export default async function AirPage() {
  const [{ t }, { all }] = await Promise.all([getDict(), flow()]);
  const smell = all.filter((r) => r.category === "smell");
  const { cells, used } = backtrace(
    smell.map((r) => ({ lat: r.lat, lng: r.lng, time: new Date(r.created_at).getTime() })),
    OBS,
    AKTAU_CENTER
  );
  const objects = (industrial.items as Obj[]).filter((o) => o.name);
  const hits = overlaps(cells, objects).slice(0, 8);
  const heat = cells
    .filter((c) => c.votes > 0.15)
    .map((c, i) => ({ id: -i - 1, no: "", c: "smell", s: "routed", lat: c.lat, lng: c.lng, t: "", d: null, b: c.votes > 0.6, demo: true, at: "" }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{t.akimat.air.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {tf(t.akimat.air.intro, { n: used, deg: SECTOR_DEG, km: MAX_DIST_M / 1000, cell: CELL_M })}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-lg border">
          <CityMap
            mode="heat"
            className="h-[460px] w-full"
            zoom={11}
            points={heat}
            polygons={objects.filter((o) => o.polygon).map((o) => ({ geojson: o.polygon as unknown as GeoJSON.GeoJsonObject, color: "#8a94a3", label: o.name ?? "" }))}
          />
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border p-4 text-sm">
            <div className="font-medium">{t.akimat.air.objects}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t.akimat.air.objectsNote}</p>
            {hits.length ? (
              <ol className="mt-2 space-y-1">
                {hits.map((h, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{h.name}</span>
                    <span className="text-xs text-muted-foreground">{h.kind}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-muted-foreground">{t.akimat.air.noObjects}</p>
            )}
          </div>
          <div className="rounded-lg border p-4 text-xs text-muted-foreground">
            {t.akimat.air.check}{" "}
            <a className="text-primary hover:underline" href="https://tengrinews.kz/kazakhstan_news/jiteli-aktau-jaluyutsya-himicheskiy-zapah-ekologi-proveli-588154/" target="_blank" rel="noopener noreferrer">
              tengrinews.kz
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
