// Модуль 8.2: вероятная зона источника запаха — обратная трассировка по ветру.
//
// Для каждой жалобы категории smell берём ветер на момент подачи (Open-Meteo, почасовой архив).
// Метеонаправление ветра = откуда дует. Значит источник — в направлении wind_deg от жалобы.
// Строим сектор ±20° длиной до 15 км, город разбит на сетку ~200 м; каждая жалоба «голосует»
// за ячейки своего сектора (вес убывает с расстоянием). Максимум голосов — вероятная зона источника.
// Формулировка строго осторожная: это совпадение жалоб и розы ветров, а не обвинение предприятий.

import { destination, pointInPolygon, type GeoPolygon, type LatLng } from "./geo";

export const SECTOR_DEG = 20;
export const MAX_DIST_M = 15000;
export const CELL_M = 200;

export type WindObs = { t: number; deg: number; speed: number };

/** Ветер на момент времени: ближайшее почасовое наблюдение (не дальше 2 ч) */
export function windAt(obs: WindObs[], time: number): WindObs | null {
  let lo = 0, hi = obs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (obs[mid].t < time) lo = mid + 1;
    else hi = mid;
  }
  const cands = [obs[lo], obs[lo - 1]].filter(Boolean);
  const best = cands.sort((a, b) => Math.abs(a.t - time) - Math.abs(b.t - time))[0];
  return best && Math.abs(best.t - time) <= 2 * 3600_000 ? best : null;
}

export type Cell = { lat: number; lng: number; votes: number };

export function backtrace(complaints: (LatLng & { time: number })[], obs: WindObs[], origin: LatLng) {
  const dLat = CELL_M / 111_320;
  const dLng = CELL_M / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  const cells = new Map<string, Cell>();
  let used = 0;
  for (const c of complaints) {
    const w = windAt(obs, c.time);
    if (!w || w.speed < 0.5) continue; // штиль — направление не определено
    used++;
    // Идём шагами по радиусу и углу внутри сектора
    for (let dist = CELL_M; dist <= MAX_DIST_M; dist += CELL_M) {
      const weight = 1 / (1 + dist / 3000);
      const halfArc = Math.max(1, Math.ceil(((2 * Math.PI * dist) * (SECTOR_DEG / 360)) / CELL_M));
      for (let k = -halfArc; k <= halfArc; k++) {
        const brg = w.deg + (SECTOR_DEG * k) / halfArc;
        const p = destination(c, brg, dist);
        const i = Math.round((p.lat - origin.lat) / dLat), j = Math.round((p.lng - origin.lng) / dLng);
        const key = `${i}:${j}`;
        const cell = cells.get(key) ?? { lat: origin.lat + i * dLat, lng: origin.lng + j * dLng, votes: 0 };
        cell.votes += weight / (2 * halfArc + 1);
        cells.set(key, cell);
      }
    }
  }
  const list = [...cells.values()];
  const max = Math.max(1e-9, ...list.map((c) => c.votes));
  return { cells: list.map((c) => ({ ...c, votes: c.votes / max })), used };
}

/** Какие объекты промзоны/порта попадают в зону максимума голосов (≥ порога) */
export function overlaps<T extends { name: string | null; polygon: GeoPolygon | null; lat: number; lng: number }>(cells: Cell[], objects: T[], threshold = 0.6) {
  const hot = cells.filter((c) => c.votes >= threshold);
  return objects
    .map((o) => {
      const score = hot.reduce((s, c) => s + ((o.polygon ? pointInPolygon(c, o.polygon) : Math.hypot(c.lat - o.lat, c.lng - o.lng) < 0.002) ? c.votes : 0), 0);
      return { ...o, score };
    })
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score);
}
