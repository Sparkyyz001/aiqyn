import { Compass, Info, Search } from "lucide-react";
import { flow, toMapPoint } from "@/lib/data";
import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { backtrace, overlaps, windAt, SECTOR_DEG, MAX_DIST_M, CELL_M, type WindObs } from "@/lib/wind";
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

/** Выпуклая оболочка точек (монотонная цепь) — контур зоны вероятного источника */
function hull(pts: [number, number][]) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// Где источник запаха: роза ветров в моменты жалоб + одна понятная зона, куда указывает ветер
export default async function AirPage() {
  const [{ lang, t }, { all }] = await Promise.all([getDict(), flow()]);
  const a = t.akimat.air;
  const smell = all.filter((r) => r.category === "smell");

  // роза ветров: с какой стороны дул ветер в час каждой жалобы (8 направлений)
  const rose = Array(8).fill(0) as number[];
  for (const r of smell) {
    const w = windAt(OBS, new Date(r.created_at).getTime());
    if (w) rose[Math.round((((w.deg % 360) + 360) % 360) / 45) % 8]++;
  }
  const roseTotal = rose.reduce((s, x) => s + x, 0) || 1;
  const top = rose.indexOf(Math.max(...rose));
  const topShare = Math.round((rose[top] / roseTotal) * 100);

  // зона: выпуклая оболочка ячеек с наибольшим совпадением направлений
  const { cells, used } = backtrace(
    smell.map((r) => ({ lat: r.lat, lng: r.lng, time: new Date(r.created_at).getTime() })),
    OBS,
    AKTAU_CENTER
  );
  const core = cells.filter((c) => c.votes >= 0.7);
  const ring = hull(core.map((c) => [c.lng, c.lat]));
  const objects = (industrial.items as Obj[]).filter((o) => o.name);
  const hits = overlaps(cells, objects, 0.7).slice(0, 3);
  const peak = core.reduce<(typeof core)[number] | null>((m, c) => (!m || c.votes > m.votes ? c : m), null);
  const zone =
    ring.length >= 3
      ? [{ geojson: { type: "Polygon", coordinates: [[...ring, ring[0]]] } as unknown as GeoJSON.GeoJsonObject, color: "#c2410c", fill: "#f97316", fillOpacity: 0.18, weight: 2.5, tooltip: `${a.zone}\n${a.zoneTip}` }]
      : [];

  // SVG-роза: 8 лепестков, длина — доля жалоб
  const R = 80;
  const maxRose = Math.max(...rose, 1);
  const petals = rose.map((v, i) => {
    const len = 18 + (v / maxRose) * (R - 18);
    const ang = (i * 45 - 90) * (Math.PI / 180);
    const w = 0.33;
    const p1 = [100 + Math.cos(ang - w) * len, 100 + Math.sin(ang - w) * len];
    const p2 = [100 + Math.cos(ang + w) * len, 100 + Math.sin(ang + w) * len];
    return { d: `M100 100 L${p1[0]} ${p1[1]} A${len} ${len} 0 0 1 ${p2[0]} ${p2[1]} Z`, lx: 100 + Math.cos(ang) * (R + 12), ly: 100 + Math.sin(ang) * (R + 12), v, i };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{a.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{tf(a.intro, { n: used, deg: SECTOR_DEG, km: MAX_DIST_M / 1000, cell: CELL_M })}</p>
      </div>

      <section className="flex items-start gap-3 rounded-2xl border-2 border-[#f97316]/40 bg-[#f97316]/[0.06] p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f97316]/15 text-[#c2410c]">
          <Search className="size-5" />
        </span>
        <div>
          <div className="text-xs font-semibold tracking-[0.12em] text-[#c2410c] uppercase">{a.verdict}</div>
          <p className="mt-1 text-pretty">
            {hits.length
              ? tf(a.verdictText, { p: topShare, dir: a.dirs[top], obj: hits.map((h) => h.name).join(", ") })
              : tf(a.verdictNoObj, { p: topShare, dir: a.dirs[top] })}
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-2xl border">
          <CityMap
            className="h-[520px] w-full"
            zoom={12}
            center={peak ? { lat: (peak.lat + AKTAU_CENTER.lat) / 2, lng: (peak.lng + AKTAU_CENTER.lng) / 2 } : AKTAU_CENTER}
            points={smell.map((r) => toMapPoint(r, lang))}
            polygons={zone}
          />
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="flex items-center gap-1.5 font-semibold">
              <Compass className="size-4 text-primary" /> {a.roseTitle}
            </h2>
            <p className="text-xs text-muted-foreground text-pretty">{a.roseSub}</p>
            <svg viewBox="0 0 200 200" className="mx-auto mt-2 w-full max-w-[260px]">
              {[0.33, 0.66, 1].map((k) => (
                <circle key={k} cx="100" cy="100" r={R * k} fill="none" stroke="var(--border)" strokeDasharray="2 3" />
              ))}
              {petals.map((p) => (
                <path key={p.i} d={p.d} fill={p.i === top ? "#f97316" : "#94a3b8"} fillOpacity={p.i === top ? 0.9 : 0.45} stroke="var(--background)" strokeWidth="1">
                  <title>{`${a.dirs[p.i]}: ${p.v}`}</title>
                </path>
              ))}
              {petals.map((p) => (
                <text key={`l${p.i}`} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight={p.i === top ? 700 : 500} fill={p.i === top ? "#c2410c" : "var(--muted-foreground)"}>
                  {a.short[p.i]}
                </text>
              ))}
            </svg>
          </section>

          <section className="rounded-2xl border bg-card p-4 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{a.reports}</span>
              <span className="text-2xl font-bold tabular-nums">{smell.length}</span>
            </div>
          </section>

          <section className="flex gap-2 rounded-2xl border p-4 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-semibold text-foreground">{a.howTitle}</div>
              <p className="mt-0.5 text-pretty">{a.how}</p>
              <p className="mt-2">
                {a.check}{" "}
                <a className="text-primary hover:underline" href="https://tengrinews.kz/kazakhstan_news/jiteli-aktau-jaluyutsya-himicheskiy-zapah-ekologi-proveli-588154/" target="_blank" rel="noopener noreferrer">
                  tengrinews.kz
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
