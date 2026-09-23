// Дедупликация (ТЗ, 6.3). Кандидат считается дублем существующего обращения, если:
//   та же категория
//   ∧ расстояние ≤ 120 м (гаверсинус)
//   ∧ создано не раньше, чем 30 дней назад
//   ∧ статус не resolved и не rejected.
// Вместо создания дубля житель жмёт «Подтверждаю» → report_confirmations → приоритет растёт.

import { haversine, type LatLng } from "./geo";

export const DEDUPE_RADIUS_M = 120;
export const DEDUPE_WINDOW_DAYS = 30;
const CLOSED = new Set(["resolved", "rejected"]);

export type DedupeCandidate = LatLng & { category_id: number };
export type DedupeReport = LatLng & {
  id: number;
  category_id: number;
  status: string;
  created_at: string;
};

export function findDuplicates<T extends DedupeReport>(
  cand: DedupeCandidate,
  reports: T[],
  now = new Date()
): (T & { distance_m: number })[] {
  const since = now.getTime() - DEDUPE_WINDOW_DAYS * 86400_000;
  return reports
    .filter((r) => r.category_id === cand.category_id && !CLOSED.has(r.status) && new Date(r.created_at).getTime() >= since)
    .map((r) => ({ ...r, distance_m: Math.round(haversine(cand, r)) }))
    .filter((r) => r.distance_m <= DEDUPE_RADIUS_M)
    .sort((a, b) => a.distance_m - b.distance_m);
}
