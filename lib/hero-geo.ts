import "server-only";
import coastline from "@/data/coastline.json";
import type { GeoPolygon } from "@/lib/geo";
import type { FlowReport } from "@/lib/data";

// Геометрия для анимации первого экрана: реальные границы микрорайонов (OSM) и береговая линия
// Каспия, спроецированные в SVG. Равнопромежуточная проекция с поправкой cos(широты) — на масштабе
// одного города искажения незаметны.

// Кадр — плотная часть города (1–35 мкр, побережье); пригороды на востоке не нужны
const FRAME = { s: 43.624, n: 43.703, w: 51.118, e: 51.212 };
const K = 10000; // единиц SVG на градус
const COS = Math.cos(((FRAME.s + FRAME.n) / 2) * (Math.PI / 180));
export const HERO_W = Math.round((FRAME.e - FRAME.w) * COS * K);
export const HERO_H = Math.round((FRAME.n - FRAME.s) * K);

const px = (lng: number) => (lng - FRAME.w) * COS * K;
const py = (lat: number) => (FRAME.n - lat) * K;

// Ломаная → path d с прореживанием точек ближе 1.2 единицы (меньше вес страницы)
function pathOf(coords: [number, number][], close: boolean) {
  let d = "";
  let lx = Infinity, ly = Infinity;
  coords.forEach(([lng, lat], i) => {
    const x = px(lng), y = py(lat);
    if (i > 0 && i < coords.length - 1 && Math.hypot(x - lx, y - ly) < 1.2) return;
    d += `${d ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    lx = x;
    ly = y;
  });
  return close ? d + "Z" : d;
}

export type HeroDot = { x: number; y: number; s: "open" | "late" | "done"; c: string; t: string; d: string | null; sv: string };

export function heroGeometry(districts: { code: string; polygon: GeoPolygon | null; kind: string }[], reports: FlowReport[], lang: "ru" | "kz") {
  const areas = districts
    .filter((d) => d.polygon && d.kind !== "zone")
    .flatMap((d) => (d.polygon!.type === "Polygon" ? [d.polygon!.coordinates[0]] : d.polygon!.coordinates.map((p) => p[0])))
    .map((ring) => pathOf(ring as [number, number][], true));

  const coast = (coastline.items as unknown as { geometry: { coordinates: [number, number][] } }[]).map((c) => pathOf(c.geometry.coordinates, false));

  // Точки: реальные и демо-обращения внутри кадра; решённые — зелёные, просроченные — красные
  // Показываем открытые и просроченные (то, что ждёт решения) и лишь каждое восьмое решённое:
  // зелёные точки «прибавляются» по ходу анимации — в этом и смысл продукта
  const inFrame = reports.filter(
    (r, i) => r.lat > FRAME.s && r.lat < FRAME.n && r.lng > FRAME.w && r.lng < FRAME.e && r.status !== "rejected" && (r.status !== "resolved" || i % 8 === 0)
  );
  const step = Math.max(1, Math.floor(inFrame.length / 240));
  const dots: HeroDot[] = inFrame
    .filter((_, i) => i % step === 0)
    .map((r) => ({
      x: +px(r.lng).toFixed(1),
      y: +py(r.lat).toFixed(1),
      s: r.status === "resolved" ? "done" : r.sla_breached ? "late" : "open",
      c: r.category,
      t: lang === "kz" && r.title_kz ? r.title_kz : r.title,
      d: r.district,
      sv: r.service,
    }));

  return { w: HERO_W, h: HERO_H, areas, coast, dots };
}
