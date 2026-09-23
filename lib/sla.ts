// SLA по закону: срок рассмотрения в РАБОЧИХ днях с учётом выходных и праздников РК.
//
// Правовая база:
//  - АППК РК, ст. 76: административная процедура по обращению — 15 рабочих дней
//    со дня поступления; продление мотивированным решением — до 2 месяцев.
//  - АППК РК, ст. 99: рассмотрение жалобы — 20 рабочих дней.
//
// Праздники: Закон РК «О праздниках в Республике Казахстан» от 13.12.2001 № 267-II
// (ред. 2022: возвращён День Республики 25 октября, исключён 1 декабря, 16 декабря — один день).
// Перенос: Трудовой кодекс РК, ст. 84 — если праздник совпал с выходным, выходной
// переносится на следующий рабочий день. Не переносятся религиозные праздники
// (Рождество 7 января, Курбан айт).
// Не учтены разовые переносы рабочих дней постановлениями Правительства — их
// нужно добавлять в EXTRA_DAYS_OFF по мере выхода постановлений.

export const TZ_OFFSET_H = 5; // Актау, UTC+5
export const WORKDAY_END_H = 18; // срок истекает в 18:00 по Актау последнего рабочего дня

// Фиксированные даты: [месяц, день, переносится ли при совпадении с выходным]
const FIXED_HOLIDAYS: [number, number, boolean][] = [
  [1, 1, true], [1, 2, true], // Новый год
  [1, 7, false], //               Православное Рождество
  [3, 8, true], //                Международный женский день
  [3, 21, true], [3, 22, true], [3, 23, true], // Наурыз мейрамы
  [5, 1, true], //                Праздник единства народа Казахстана
  [5, 7, true], //                День защитника Отечества
  [5, 9, true], //                День Победы
  [7, 6, true], //                День столицы
  [8, 30, true], //               День Конституции
  [10, 25, true], //              День Республики
  [12, 16, true], //              День Независимости
];

// Курбан айт (первый день) — по исламскому календарю, даты объявляются ежегодно
const KURBAN_AIT = ["2025-06-06", "2026-05-27", "2027-05-16"];

// Разовые переносы рабочих дней постановлениями Правительства (YYYY-MM-DD)
const EXTRA_DAYS_OFF: string[] = [];

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// «Локальная» дата Актау, закодированная в UTC-полях (чтобы не зависеть от TZ сервера)
const toLocal = (d: Date) => new Date(d.getTime() + TZ_OFFSET_H * 3600_000);
const fromLocal = (d: Date) => new Date(d.getTime() - TZ_OFFSET_H * 3600_000);

const holidayCache = new Map<number, Set<string>>();

export function holidaysOf(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const days = new Set<string>([...KURBAN_AIT, ...EXTRA_DAYS_OFF].filter((d) => d.startsWith(String(year))));
  const transfers: Date[] = [];
  for (const [m, day, movable] of FIXED_HOLIDAYS) {
    const d = new Date(Date.UTC(year, m - 1, day));
    days.add(ymd(d));
    const wd = d.getUTCDay();
    if (movable && (wd === 0 || wd === 6)) transfers.push(d);
  }
  // Перенос: на ближайший следующий день, который не выходной и не праздник
  for (const h of transfers) {
    const d = new Date(h);
    do d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || days.has(ymd(d)));
    days.add(ymd(d));
  }
  holidayCache.set(year, days);
  return days;
}

/** Рабочий ли день (дата — в локальной кодировке Актау) */
function isWorkingLocal(local: Date): boolean {
  const wd = local.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  return !holidaysOf(local.getUTCFullYear()).has(ymd(local));
}

export function isWorkingDay(date: Date): boolean {
  return isWorkingLocal(toLocal(date));
}

/**
 * Дедлайн: N рабочих дней, считая со СЛЕДУЮЩЕГО дня после поступления
 * (день поступления не засчитывается), срок истекает в 18:00 по Актау.
 */
export function addWorkingDays(from: Date, n: number): Date {
  const local = toLocal(from);
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkingLocal(d)) left--;
  }
  d.setUTCHours(WORKDAY_END_H);
  return fromLocal(d);
}

/** Сколько рабочих дней между датами (без учёта дня `from`), может быть отрицательным */
export function workingDaysBetween(from: Date, to: Date): number {
  const sign = to >= from ? 1 : -1;
  const [a, b] = sign > 0 ? [from, to] : [to, from];
  const la = toLocal(a), lb = toLocal(b);
  const d = new Date(Date.UTC(la.getUTCFullYear(), la.getUTCMonth(), la.getUTCDate()));
  const end = new Date(Date.UTC(lb.getUTCFullYear(), lb.getUTCMonth(), lb.getUTCDate()));
  let count = 0;
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkingLocal(d)) count++;
  }
  return sign * count;
}

export const slaDueAt = (createdAt: Date, slaDays = 15) => addWorkingDays(createdAt, slaDays);

/**
 * Решение команды: при переоткрытии (житель сказал «не сделано») служба получает
 * 5 рабочих дней на переделку, но не меньше исходного срока. Иначе переоткрытие
 * «обнуляло» бы просрочку и было бы выгодно службе.
 */
export const REOPEN_EXTRA_DAYS = 5;
export function slaDueAfterReopen(originalDue: Date, reopenedAt: Date): Date {
  const redo = addWorkingDays(reopenedAt, REOPEN_EXTRA_DAYS);
  return redo > originalDue ? redo : originalDue;
}

export type SlaLevel = "ok" | "warn" | "danger" | "done";

export type SlaState = {
  level: SlaLevel;
  breached: boolean;
  /** рабочих дней до срока (>0) или просрочки (<0) */
  workingDaysLeft: number;
  msLeft: number;
};

/** Состояние таймера для карточки: зелёный → жёлтый (≤3 рабочих дня) → красный (просрочено) */
export function slaState(dueAt: Date | null, now = new Date(), closed = false): SlaState {
  if (!dueAt) return { level: "ok", breached: false, workingDaysLeft: 15, msLeft: Infinity };
  const msLeft = dueAt.getTime() - now.getTime();
  const workingDaysLeft = workingDaysBetween(now, dueAt);
  if (closed) return { level: "done", breached: msLeft < 0, workingDaysLeft, msLeft };
  if (msLeft < 0) return { level: "danger", breached: true, workingDaysLeft, msLeft };
  return { level: workingDaysLeft <= 3 ? "warn" : "ok", breached: false, workingDaysLeft, msLeft };
}
