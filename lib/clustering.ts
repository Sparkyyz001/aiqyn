// ФИШКА 7: системные узлы — DBSCAN-подобная кластеризация обращений.
//
// Внутри одной категории: точка «ядро», если в радиусе 80 м есть ≥ 3 обращений (включая её).
// Кластер = ядра, связанные через соседство, + их соседи. Одиночки не образуют узел.
//
// chronic_score (0..1) = 1 − exp(−x), где
//   x = 0.15·(N − 2)          сколько раз жаловались (сверх минимума)
//     + 0.004·(дней от первой до последней жалобы)   как долго тянется
//     + 0.25·(сумма переоткрытий)                    сколько раз «закрывали на бумаге»
//     + 0.5·(доля просроченных)                      насколько систематически срывают сроки
// Экспонента даёт насыщение: узел с 3 жалобами за неделю ≈ 0.2, двор 3 мкр с годом жалоб ≈ 0.9+.

import { haversine, type LatLng } from "./geo";

export const CLUSTER_EPS_M = 80;
export const CLUSTER_MIN_PTS = 3;

export type ClusterPoint = LatLng & {
  id: number;
  created_at: string;
  reopen_count: number;
  breached: boolean;
};

export type Cluster<T extends ClusterPoint> = {
  members: T[];
  center: LatLng;
  radius_m: number;
  first_seen: string;
  last_seen: string;
  reopen_total: number;
  chronic_score: number;
};

export function dbscan<T extends ClusterPoint>(points: T[], eps = CLUSTER_EPS_M, minPts = CLUSTER_MIN_PTS): Cluster<T>[] {
  const n = points.length;
  const neighbors: number[][] = points.map((p, i) => {
    const out: number[] = [];
    for (let j = 0; j < n; j++) if (haversine(p, points[j]) <= eps) out.push(j);
    return out; // включает саму точку
  });
  const label = new Array<number>(n).fill(-1);
  let cid = 0;
  for (let i = 0; i < n; i++) {
    if (label[i] !== -1 || neighbors[i].length < minPts) continue;
    const queue = [i];
    label[i] = cid;
    while (queue.length) {
      const k = queue.pop()!;
      if (neighbors[k].length < minPts) continue; // граничная точка — не расширяем
      for (const j of neighbors[k]) {
        if (label[j] === -1) {
          label[j] = cid;
          queue.push(j);
        }
      }
    }
    cid++;
  }
  const groups: T[][] = Array.from({ length: cid }, () => []);
  label.forEach((l, i) => l >= 0 && groups[l].push(points[i]));
  return groups.map(summarize);
}

export function chronicScore(n: number, spanDays: number, reopens: number, breachedShare: number): number {
  const x = 0.15 * Math.max(0, n - 2) + 0.004 * spanDays + 0.25 * reopens + 0.5 * breachedShare;
  return Math.round((1 - Math.exp(-x)) * 100) / 100;
}

function summarize<T extends ClusterPoint>(members: T[]): Cluster<T> {
  const center = {
    lat: members.reduce((s, p) => s + p.lat, 0) / members.length,
    lng: members.reduce((s, p) => s + p.lng, 0) / members.length,
  };
  const times = members.map((m) => new Date(m.created_at).getTime()).sort((a, b) => a - b);
  const spanDays = (times[times.length - 1] - times[0]) / 86400_000;
  const reopen_total = members.reduce((s, m) => s + m.reopen_count, 0);
  const breachedShare = members.filter((m) => m.breached).length / members.length;
  return {
    members,
    center,
    radius_m: Math.max(40, Math.round(Math.max(...members.map((m) => haversine(center, m))))),
    first_seen: new Date(times[0]).toISOString(),
    last_seen: new Date(times[times.length - 1]).toISOString(),
    reopen_total,
    chronic_score: chronicScore(members.length, spanDays, reopen_total, breachedShare),
  };
}
