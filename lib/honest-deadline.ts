import model from "@/data/honest_deadline_model.json";

// «Честный срок»: рядом со сроком по закону — прогноз, когда обращение решат на самом деле.
//
// Как считается (объяснимо, без чёрного ящика):
//   1. Относительная скорость категорий, сезон, выходной день подачи и нагрузка на службу —
//      множители, измеренные на реальных обращениях NYC 311 (ml/honest_deadline/train.py,
//      проверка по времени, метрики в ml/honest_deadline/metrics.md).
//   2. Уровень и разброс — по уже решённым похожим обращениям в Актау: чем их больше, тем больше
//      им доверяем (сглаживание с весом k к «приору» из п. 1). Разброс берём местный: «хвосты»
//      затяжных случаев у каждого города свои, переносить нью-йоркские было бы нечестно.
//   3. Всегда интервал, а не точка, и всегда база расчёта. Если похожих решённых обращений
//      меньше 20 — прогноз честно не показываем.
//   4. Для уже открытых обращений прогноз условный: учитываем, что заявка уже висит N дней.

const DAY = 86_400_000;
export const MIN_SIMILAR = 20;
const PRIOR_K = 30; // «вес» приора в штуках наблюдений
const DISTRICT_K = 15;

const COEF = model.coef as Record<string, number>;
const QS = model.quantiles as number[];
const REF = model.reference;
const T = model.transfer as { cat_rel: Record<string, number>; month: Record<string, number[]>; load: Record<string, number>; weekend: number };

/** Относительная скорость категории (лог-множитель, центрирован по категориям; нет аналога в NYC — 0) */
const catRel = (c: string) => T.cat_rel[c] ?? 0;

/** Предсказание исходной NYC-модели (лог дней) — только для проверки паритета с Python */
export function nycPredictLog(v: { category: string; district: string; month: number; weekend: number; load: number }) {
  const c = v.category;
  let y = model.intercept + (COEF[`cat:${c}`] ?? 0);
  if (v.district !== REF.district) y += COEF[`cd:${c}:${v.district}`] ?? 0;
  if (v.month !== REF.month) y += COEF[`cm:${c}:${v.month}`] ?? 0;
  return y + v.load * (COEF[`cl:${c}`] ?? 0) + v.weekend * COEF.weekend;
}

// Месяц и день недели — по времени Актау (UTC+5)
const local = (d: Date) => new Date(d.getTime() + 5 * 3600_000);
const monthOf = (d: Date) => local(d).getUTCMonth() + 1;
const weekendOf = (d: Date) => (local(d).getUTCDay() === 0 || local(d).getUTCDay() === 6 ? 1 : 0);

/** Поправки из NYC для категории: сезон + нагрузка + выходной (лог-множитель) */
function corrections(cat: string, created: Date, loadLog: number) {
  return (T.month[cat]?.[monthOf(created) - 1] ?? 0) + loadLog * (T.load[cat] ?? 0) + weekendOf(created) * T.weekend;
}

export type HonestReport = {
  id: number;
  category: string;
  service: string;
  district: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  sla_due_at: string | null;
};

export type HonestForecast =
  | {
      ok: true;
      /** ожидаемая дата решения и интервал 10–90% */
      date: string;
      lo: string;
      hi: string;
      /** ожидаемый срок в днях от подачи и полуширина интервала */
      days: number;
      spread: number;
      /** на сколько календарных дней прогноз позже законного срока (<0 — раньше) */
      lateBy: number | null;
      /** вероятность не уложиться в законный срок (с учётом того, сколько уже прошло) */
      pBreach: number | null;
      /** сколько решённых похожих обращений в Актау легло в основу */
      n: number;
    }
  | { ok: false; n: number };

type Ctx = {
  global: number;
  byCat: Map<string, number[]>;
  resq: Map<string, number[]>; // квантили отклонений от медианы категории (местный разброс)
  distAdj: Map<string, number>;
  created: Map<string, number[]>; // времена поступления по категориям — для нагрузки
  span: [number, number];
};

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Нагрузка: поступления категории за 14 дней до момента t относительно среднего за 14 дней */
function loadLog(ctx: Ctx, cat: string, t: number) {
  const times = ctx.created.get(cat);
  if (!times || times.length < 10) return 0;
  const days = Math.max(14, (ctx.span[1] - ctx.span[0]) / DAY);
  const base = (times.length * 14) / days;
  const recent = times.filter((x) => x < t && x >= t - 14 * DAY).length;
  return Math.log(Math.min(5, Math.max(0.2, recent / Math.max(base, 0.5))));
}

/** Готовит контекст по истории (один раз на запрос страницы) */
export function honestContext(history: HonestReport[]): Ctx {
  const created = new Map<string, number[]>();
  let lo = Infinity;
  let hi = -Infinity;
  for (const h of history) {
    const t = new Date(h.created_at).getTime();
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
    const arr = created.get(h.category) ?? [];
    arr.push(t);
    created.set(h.category, arr);
  }
  const ctx: Ctx = { global: 0, byCat: new Map(), resq: new Map(), distAdj: new Map(), created, span: [lo, hi] };

  // «очищенный» срок каждого решённого: минус сезон/выходной/нагрузка и относительная скорость категории
  const solved = history.filter((h) => h.status === "resolved" && h.resolved_at);
  const z: { cat: string; district: string | null; v: number }[] = [];
  for (const h of solved) {
    const c = new Date(h.created_at);
    const days = (new Date(h.resolved_at!).getTime() - c.getTime()) / DAY;
    if (!(days > 0)) continue;
    const v = Math.log1p(days) - corrections(h.category, c, loadLog(ctx, h.category, c.getTime()));
    z.push({ cat: h.category, district: h.district, v });
  }
  if (!z.length) return ctx;
  ctx.global = median(z.map((x) => x.v - catRel(x.cat)));
  for (const x of z) ctx.byCat.set(x.cat, [...(ctx.byCat.get(x.cat) ?? []), x.v]);

  // поправка района: средний остаток района относительно своей категории, со сжатием к нулю
  const catMed = new Map([...ctx.byCat].map(([c, a]) => [c, median(a)]));
  const acc = new Map<string, { s: number; n: number }>();
  for (const x of z) {
    if (!x.district) continue;
    const a = acc.get(x.district) ?? { s: 0, n: 0 };
    a.s += x.v - catMed.get(x.cat)!;
    a.n++;
    acc.set(x.district, a);
  }
  for (const [d, a] of acc) ctx.distAdj.set(d, a.s / (a.n + DISTRICT_K));

  // местный разброс: квантили отклонений решённых обращений категории от её медианы
  for (const [c, arr] of ctx.byCat) {
    const m = catMed.get(c)!;
    const dev = arr.map((v) => v - m).sort((x, y) => x - y);
    ctx.resq.set(c, QS.map((p) => quantile(dev, p)));
  }
  return ctx;
}

/** Квантиль отсортированного массива с линейной интерполяцией */
function quantile(sorted: number[], p: number) {
  const x = (sorted.length - 1) * p;
  const i = Math.floor(x);
  return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (x - i);
}

// Распределение отклонения (лог-пространство) по квантилям: F(r) и обратная
// За краем наблюдений (дольше, чем решали почти все похожие) — экспоненциальный «хвост»,
// подогнанный по последним 10% квантилей: вероятность решения продолжает плавно убывать,
// а не обрывается. Иначе у давно зависших заявок прогноз «сегодня» и риск ровно 100%.
function tailScale(q: number[]) {
  const k = q.length - 1;
  const j = Math.max(0, k - 10);
  const lam = (q[k] - q[j]) / Math.log((1 - QS[j]) / (1 - QS[k]));
  return lam > 1e-3 ? lam : 0.25;
}
function cdf(q: number[], r: number) {
  const k = q.length - 1;
  if (r <= q[0]) return QS[0] / 2;
  if (r >= q[k]) return 1 - (1 - QS[k]) * Math.exp(-(r - q[k]) / tailScale(q));
  for (let i = 1; i <= k; i++) if (r <= q[i]) return QS[i - 1] + ((QS[i] - QS[i - 1]) * (r - q[i - 1])) / Math.max(q[i] - q[i - 1], 1e-9);
  return QS[k];
}
function inv(q: number[], p: number) {
  const k = q.length - 1;
  if (p <= QS[0]) return q[0] - (q[1] - q[0]) * ((QS[0] - p) / (QS[1] - QS[0]));
  if (p >= QS[k]) return q[k] + tailScale(q) * Math.log((1 - QS[k]) / Math.max(1 - p, 1e-12));
  for (let i = 1; i <= k; i++) if (p <= QS[i]) return q[i - 1] + ((q[i] - q[i - 1]) * (p - QS[i - 1])) / (QS[i] - QS[i - 1]);
  return q[k];
}

export function honestForecast(r: HonestReport, ctx: Ctx, now = new Date()): HonestForecast {
  const similar = ctx.byCat.get(r.category) ?? [];
  const n = similar.length;
  if (n < MIN_SIMILAR || ["resolved", "rejected"].includes(r.status)) return { ok: false, n };

  const created = new Date(r.created_at);
  const prior = ctx.global + catRel(r.category);
  const level = (PRIOR_K * prior + n * median(similar)) / (PRIOR_K + n) + (r.district ? ctx.distAdj.get(r.district) ?? 0 : 0);
  const mu = level + corrections(r.category, created, loadLog(ctx, r.category, created.getTime()));
  const q = ctx.resq.get(r.category)!;

  // Условное распределение: заявка уже открыта elapsed дней — считаем только «хвост» после этого
  const elapsed = Math.max(0, (now.getTime() - created.getTime()) / DAY);
  const f0 = cdf(q, Math.log1p(elapsed) - mu);
  const at = (p: number) => Math.max(elapsed, Math.expm1(mu + inv(q, f0 + (1 - f0) * p)));
  const days = at(0.5);
  const loD = at(0.1);
  const hiD = at(0.9);

  let lateBy: number | null = null;
  let pBreach: number | null = null;
  if (r.sla_due_at) {
    const dueDays = (new Date(r.sla_due_at).getTime() - created.getTime()) / DAY;
    lateBy = Math.round(days - dueDays);
    if (elapsed >= dueDays) pBreach = 1;
    else {
      const fd = cdf(q, Math.log1p(dueDays) - mu);
      pBreach = Math.min(1, Math.max(0, (1 - fd) / Math.max(1 - f0, 1e-6)));
    }
  }
  const iso = (d: number) => new Date(created.getTime() + d * DAY).toISOString();
  return { ok: true, date: iso(days), lo: iso(loD), hi: iso(hiD), days: Math.round(days), spread: Math.max(1, Math.round((hiD - loD) / 2)), lateBy, pBreach, n };
}

/** Метрики проверки модели на NYC 311 — для подписи в интерфейсе и на экране акимата */
export const honestMetrics = model.metrics;
