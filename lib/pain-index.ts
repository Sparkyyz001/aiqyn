// ДОПОЛНЕНИЕ 2: «Индекс боли» микрорайона — где людям реально хуже живётся, а не где больше жалуются.
//
// pain_raw(район) =
//     Σ priority_score всех НЕЗАКРЫТЫХ обращений района           ← текущая боль; priority_score уже включает
//                                                                    тяжесть категории, подтверждения, время
//                                                                    в очереди, школы/больницы рядом, просрочку,
//                                                                    хроничность узла и переоткрытия (lib/priority.ts)
//   + 0.3 × Σ priority_score обращений, закрытых за последние 30 дней
//                                                                 ← недавно разгребли завал — район всё ещё
//                                                                    не идеален; решённое весит в 3 раза меньше
//   ────────────────────────────────────────────────────────────
//   население района / 1000                                      ← на 1000 жителей: иначе большой район всегда
//                                                                    «хуже» маленького просто из-за числа людей
//
// pain_index = pain_raw / max(pain_raw по районам) × 100          ← шкала 0–100, 100 = худший район города
//
// «Недостаточно данных»: меньше 5 обращений за 90 дней или неизвестно население — индекс не показываем,
// чтобы не рисовать красивый ноль там, где просто мало информации.
// Индекс НЕ смешивается с активностью жителей: число жалоб само по себе в него не входит.

import type { BaseReport } from "./demo-baseline";

export const CLOSED_WEIGHT = 0.3;
export const CLOSED_WINDOW_DAYS = 30;
export const MIN_REPORTS = 5;
export const WINDOW_DAYS = 90;
const DAY = 86400_000;

// Группы причин для разбивки индекса
export const PAIN_GROUPS = {
  roads: ["road_pit", "excavation"],
  water: ["water_outage", "sewage", "heating"],
  power: ["power_outage", "lighting"],
  garbage: ["garbage"],
  air: ["smell"],
  other: ["yard", "transport", "beach", "other"],
} satisfies Record<string, string[]>;
export type PainGroup = keyof typeof PAIN_GROUPS;
const GROUP_OF: Record<string, PainGroup> = Object.fromEntries(
  Object.entries(PAIN_GROUPS).flatMap(([g, cats]) => (cats as string[]).map((c) => [c, g as PainGroup]))
);

export type DistrictPop = { code: string; population: number | null };

export type PainRow = {
  district: string;
  population: number | null;
  reports90: number;
  open: number;
  breached: number;
  reopened: number;
  raw: number | null; // баллов приоритета на 1000 жителей
  index: number | null; // 0–100, null = недостаточно данных
  insufficient: boolean;
  breakdown: { group: PainGroup; value: number; share: number }[]; // вклад групп в индекс
};

/** Состояние обращения на дату `at`: открыто / закрыто в последние 30 дней / не учитывается */
function stateAt(r: BaseReport, at: number): "open" | "recent" | null {
  const created = new Date(r.created_at).getTime();
  if (created > at) return null;
  const closedAt = r.resolved_at ? new Date(r.resolved_at).getTime() : r.status === "rejected" ? created : null;
  if (r.status === "rejected") return null; // отклонённые — не боль района
  if (closedAt == null || closedAt > at) return "open";
  return at - closedAt <= CLOSED_WINDOW_DAYS * DAY ? "recent" : null;
}

/** Индекс боли по всем районам на момент `at` (по умолчанию — сейчас) */
export function painIndex(reports: BaseReport[], districts: DistrictPop[], at = Date.now()): PainRow[] {
  const acc = new Map<string, { sum: number; groups: Record<string, number>; reports90: number; open: number; breached: number; reopened: number }>();
  for (const d of districts) acc.set(d.code, { sum: 0, groups: {}, reports90: 0, open: 0, breached: 0, reopened: 0 });

  for (const r of reports) {
    if (!r.district) continue;
    const a = acc.get(r.district);
    if (!a) continue;
    const created = new Date(r.created_at).getTime();
    if (created <= at && at - created <= WINDOW_DAYS * DAY) a.reports90++;
    const st = stateAt(r, at);
    if (!st) continue;
    const w = st === "open" ? 1 : CLOSED_WEIGHT; // закрытые недавно — с коэффициентом 0.3
    const contribution = w * r.priority;
    a.sum += contribution;
    const g = GROUP_OF[r.category] ?? "other";
    a.groups[g] = (a.groups[g] ?? 0) + contribution;
    if (st === "open") {
      a.open++;
      if (r.sla_breached) a.breached++;
    }
    if (r.reopen_count > 0) a.reopened++;
  }

  const rows: PainRow[] = districts.map((d) => {
    const a = acc.get(d.code)!;
    const insufficient = a.reports90 < MIN_REPORTS || !d.population;
    // Нормировка на население: баллы приоритета на 1000 жителей
    const raw = insufficient ? null : a.sum / (d.population! / 1000);
    return {
      district: d.code,
      population: d.population,
      reports90: a.reports90,
      open: a.open,
      breached: a.breached,
      reopened: a.reopened,
      raw,
      index: null,
      insufficient,
      breakdown: (Object.keys(PAIN_GROUPS) as PainGroup[])
        .map((g) => ({ group: g, value: a.groups[g] ?? 0, share: a.sum ? (a.groups[g] ?? 0) / a.sum : 0 }))
        .filter((b) => b.value > 0)
        .sort((x, y) => y.value - x.value),
    };
  });

  // Шкала 0–100 относительно худшего района города
  const max = Math.max(0, ...rows.map((r) => r.raw ?? 0));
  for (const r of rows) {
    if (r.raw == null || max === 0) continue;
    r.index = Math.round((r.raw / max) * 100);
    // разбивка в баллах индекса: вклад группы = её доля × индекс
    r.breakdown = r.breakdown.map((b) => ({ ...b, value: Math.round(b.share * r.index! * 10) / 10 }));
  }
  return rows.sort((a, b) => (b.index ?? -1) - (a.index ?? -1));
}

/**
 * История индекса района за N дней. Восстанавливается из того же потока обращений:
 * на каждую прошлую дату известно, что было открыто (создано раньше, решено позже)
 * и что закрыто в последние 30 дней. Шкала — к худшему району на ту же дату.
 */
export function painHistory(reports: BaseReport[], districts: DistrictPop[], code: string, days = 90, now = Date.now()) {
  const out: { date: string; index: number | null }[] = [];
  for (let i = days - 1; i >= 0; i -= 3) {
    const at = now - i * DAY;
    const row = painIndex(reports, districts, at).find((r) => r.district === code);
    out.push({ date: new Date(at).toISOString().slice(0, 10), index: row?.index ?? null });
  }
  return out;
}

/** Изменение индекса за 30 дней (для стрелки в рейтинге) */
export function painDelta(reports: BaseReport[], districts: DistrictPop[], now = Date.now()) {
  const past = new Map(painIndex(reports, districts, now - 30 * DAY).map((r) => [r.district, r.index]));
  return (code: string, current: number | null) => {
    const p = past.get(code);
    return current == null || p == null ? null : current - p;
  };
}

// Последовательная шкала одного оттенка (проверена валидатором палитр: монотонная яркость,
// видимые шаги, светлый край отличим от фона). В тёмной теме шкала развёрнута:
// малый индекс ближе к фону, большой — ярче.
export const PAIN_RAMP_LIGHT = ["#e39a7a", "#d97c58", "#c9603d", "#ad4328", "#7f2818"];
export const PAIN_RAMP_DARK = ["#9a3a22", "#b8502f", "#d06a45", "#e38b66", "#f0b193"];
export const painColor = (index: number | null, dark = false) => {
  if (index == null) return "#9aa3ad"; // недостаточно данных — нейтральный серый
  const ramp = dark ? PAIN_RAMP_DARK : PAIN_RAMP_LIGHT;
  return ramp[Math.min(ramp.length - 1, Math.floor(index / (100 / ramp.length)))];
};
