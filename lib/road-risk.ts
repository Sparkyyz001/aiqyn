// Модуль 8.1: индекс риска разрушения дорожных сегментов (прозрачная формула, не «чёрный ящик»).
//
// risk = 1 − exp(−x),  x = 0.35·жалоб_рядом(≤40 м, 90 дн.) + 0.6·класс_нагрузки + 0.25·длина_км
//                         + 0.4·(переходов через 0 °C за последний холодный сезон / 60)
// Жалобы — главный сигнал; класс дороги (primary/trunk сильнее нагружены) и длина — экспозиция;
// переходы через 0 °C по данным Open-Meteo — главный климатический разрушитель покрытия.
//
// Почему не ML: для обучения нужна реальная история ремонтов и жалоб по сегментам. На синтетике
// модель выучила бы сама себя. Как только в базе накопятся реальные обращения, этот же набор
// признаков идёт в обучение регрессии (scikit-learn) с экспортом весов в JSON.

import { haversine, type LatLng } from "./geo";

export const CLASS_LOAD: Record<string, number> = {
  trunk: 1, primary: 0.9, secondary: 0.7, tertiary: 0.5, residential: 0.3, living_street: 0.2, unclassified: 0.3, service: 0.15,
};

type Seg = { osm_id: string; name: string | null; highway: string; geometry: { coordinates: [number, number][] } };

/** Расстояние от точки до ломаной (м), через проекцию на отрезки в локальной плоскости */
export function distToLine(p: LatLng, coords: [number, number][]): number {
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180), ky = 110_540;
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = [(coords[i][0] - p.lng) * kx, (coords[i][1] - p.lat) * ky];
    const [bx, by] = [(coords[i + 1][0] - p.lng) * kx, (coords[i + 1][1] - p.lat) * ky];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export function lengthKm(coords: [number, number][]) {
  let s = 0;
  for (let i = 0; i < coords.length - 1; i++) s += haversine({ lat: coords[i][1], lng: coords[i][0] }, { lat: coords[i + 1][1], lng: coords[i + 1][0] });
  return s / 1000;
}

export function roadRisk(segments: Seg[], complaints: LatLng[], freezeThaw: number) {
  return segments
    .map((s) => {
      const c = s.geometry.coordinates;
      const lats = c.map((x) => x[1]), lngs = c.map((x) => x[0]);
      const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats) - 0.0005, Math.max(...lats) + 0.0005, Math.min(...lngs) - 0.0007, Math.max(...lngs) + 0.0007];
      const near = complaints.filter((p) => p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng && distToLine(p, c) <= 40).length;
      const km = lengthKm(c);
      const load = CLASS_LOAD[s.highway] ?? 0.3;
      const x = 0.35 * near + 0.6 * load + 0.25 * km + 0.4 * (freezeThaw / 60);
      return { osm_id: s.osm_id, name: s.name, highway: s.highway, km: Math.round(km * 100) / 100, complaints: near, risk: Math.round((1 - Math.exp(-x)) * 100) / 100, coords: c };
    })
    .sort((a, b) => b.risk - a.risk);
}
