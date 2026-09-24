import { flow, toMapPoint } from "@/lib/data";
import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { backtrace, overlaps, SECTOR_DEG, MAX_DIST_M, CELL_M, type WindObs } from "@/lib/wind";
import { AKTAU_CENTER, haversine, type GeoPolygon } from "@/lib/geo";
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

// Типы объектов OSM по-человечески
const KIND: Record<string, { ru: string; kz: string }> = {
  industrial: { ru: "промышленная зона", kz: "өнеркәсіп аймағы" },
  wastewater_plant: { ru: "очистные сооружения", kz: "тазарту құрылғылары" },
  landfill: { ru: "полигон отходов", kz: "қалдықтар полигоны" },
  works: { ru: "предприятие", kz: "кәсіпорын" },
  chimney: { ru: "дымовая труба", kz: "түтін құбыры" },
  harbour: { ru: "порт", kz: "порт" },
  heating_station: { ru: "котельная / ТЭЦ", kz: "қазандық / ЖЭО" },
};
// Шкала «вероятность источника»: светло-жёлтый → оранжевый → тёмно-красный
const RAMP = ["#fde68a", "#fbbf24", "#f59e0b", "#ea580c", "#c2410c", "#7c2d12"];
const rampColor = (v: number) => RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))];

export default async function AirPage() {
  const [{ lang, t }, { all }] = await Promise.all([getDict(), flow()]);
  const a = t.akimat.air;
  const smell = all.filter((r) => r.category === "smell");
  const { cells, used } = backtrace(
    smell.map((r) => ({ lat: r.lat, lng: r.lng, time: new Date(r.created_at).getTime() })),
    OBS,
    AKTAU_CENTER
  );
  const objects = (industrial.items as Obj[]).filter((o) => o.name);
  const hits = overlaps(cells, objects).slice(0, 6);
  const maxScore = Math.max(1e-9, ...hits.map((h) => h.score));

  // Ячейки сетки как квадраты 200×200 м, цвет и прозрачность — по вероятности; подсказка при наведении
  // показываем только ядро зоны (от 65% максимума) — слабые «хвосты» секторов закрывают весь город
  const hot = cells.filter((c) => c.votes >= 0.65);
  const dLat = CELL_M / 111_320;
  const cellPolys = hot.map((c) => {
    const dLng = CELL_M / (111_320 * Math.cos((c.lat * Math.PI) / 180));
    const nearest = objects.reduce<{ o: Obj | null; d: number }>((best, o) => {
      const d = haversine(c, o);
      return d < best.d ? { o, d } : best;
    }, { o: null, d: Infinity });
    const tip = [tf(a.cellTip, { p: Math.round(c.votes * 100) }), nearest.o ? tf(a.nearest, { name: nearest.o.name ?? "", km: (nearest.d / 1000).toFixed(1) }) : ""].filter(Boolean).join("\n");
    return {
      geojson: {
        type: "Polygon",
        coordinates: [[[c.lng - dLng / 2, c.lat - dLat / 2], [c.lng + dLng / 2, c.lat - dLat / 2], [c.lng + dLng / 2, c.lat + dLat / 2], [c.lng - dLng / 2, c.lat + dLat / 2], [c.lng - dLng / 2, c.lat - dLat / 2]]],
      } as unknown as GeoJSON.GeoJsonObject,
      color: rampColor((c.votes - 0.65) / 0.35),
      fill: rampColor((c.votes - 0.65) / 0.35),
      fillOpacity: 0.15 + 0.6 * c.votes,
      weight: 0,
      tooltip: tip,
    };
  });
  const objPolys = objects
    .filter((o) => o.polygon)
    .map((o) => ({ geojson: o.polygon as unknown as GeoJSON.GeoJsonObject, color: "#475569", fillOpacity: 0.08, weight: 1.2, tooltip: `${o.name}${o.kind ? ` · ${KIND[o.kind]?.[lang] ?? o.kind}` : ""}` }));

  // центр карты — самая вероятная ячейка (центр тяжести уводят длинные «хвосты» секторов)
  const peak = hot.reduce<(typeof hot)[number] | null>((m, c) => (!m || c.votes > m.votes ? c : m), null);
  const center = peak ? { lat: peak.lat, lng: peak.lng } : AKTAU_CENTER;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{a.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">
          {tf(a.intro, { n: used, deg: SECTOR_DEG, km: MAX_DIST_M / 1000, cell: CELL_M })}
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-xl border">
          <CityMap className="h-[520px] w-full" zoom={13} center={center} points={smell.map((r) => toMapPoint(r, lang))} polygons={[...objPolys, ...cellPolys]} />
          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span>{a.legend}</span>
            <span>{a.low}</span>
            <span className="flex h-2 w-40 overflow-hidden rounded-full">
              {RAMP.map((c) => (
                <span key={c} className="h-full flex-1" style={{ background: c }} />
              ))}
            </span>
            <span>{a.high}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border bg-card p-4 text-sm">
            <div className="font-semibold">{a.objects}</div>
            <p className="mt-1 text-xs text-muted-foreground">{a.objectsNote}</p>
            {hits.length ? (
              <ol className="mt-3 flex flex-col gap-3">
                {hits.map((h, i) => {
                  const p = Math.round((h.score / maxScore) * 100);
                  return (
                    <li key={i}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{h.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{tf(a.share, { p })}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: rampColor(p / 100) }} />
                      </div>
                      {h.kind && <div className="mt-0.5 text-xs text-muted-foreground">{KIND[h.kind]?.[lang] ?? h.kind}</div>}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-2 text-muted-foreground">{a.noObjects}</p>
            )}
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm">
            <div className="font-semibold">{a.reports}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{smell.length}</div>
          </div>
          <div className="rounded-xl border p-4 text-xs text-muted-foreground">
            {a.check}{" "}
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
