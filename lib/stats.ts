// Агрегаты для лендинга и дашборда акимата. Чистые функции над потоком обращений.

import type { BaseReport } from "./demo-baseline";
import { BOILERPLATE_THRESHOLD } from "./boilerplate";

const DAY = 86400_000;
const isClosed = (s: string) => s === "resolved" || s === "rejected";
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (x: number) => Math.round(x * 10) / 10;

export function kpis(rs: BaseReport[], now = new Date()) {
  const open = rs.filter((r) => !isClosed(r.status));
  const resolved = rs.filter((r) => r.status === "resolved");
  const days = resolved.filter((r) => r.resolved_at).map((r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / DAY);
  const last7 = rs.filter((r) => now.getTime() - new Date(r.created_at).getTime() < 7 * DAY).length;
  return {
    total: rs.length,
    open: open.length,
    resolved: resolved.length,
    breachedOpen: open.filter((r) => r.sla_breached).length,
    breachedTotal: rs.filter((r) => r.sla_breached).length,
    reopened: rs.filter((r) => r.reopen_count > 0).length,
    medianDays: round1(median(days)),
    last7,
    awaiting: rs.filter((r) => r.status === "awaiting_confirmation").length,
  };
}

/** Динамика по дням: поступило / решено */
export function daily(rs: BaseReport[], days = 90, now = new Date()) {
  const start = new Date(now.getTime() - (days - 1) * DAY);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const map = new Map<string, { date: string; created: number; resolved: number }>();
  for (let i = 0; i < days; i++) {
    const d = key(new Date(start.getTime() + i * DAY));
    map.set(d, { date: d, created: 0, resolved: 0 });
  }
  for (const r of rs) {
    const c = map.get(r.created_at.slice(0, 10));
    if (c) c.created++;
    if (r.resolved_at) {
      const x = map.get(r.resolved_at.slice(0, 10));
      if (x) x.resolved++;
    }
  }
  return [...map.values()];
}

export function byKey(rs: BaseReport[], key: (r: BaseReport) => string | null) {
  const m = new Map<string, { key: string; total: number; open: number; breached: number; resolved: number }>();
  for (const r of rs) {
    const k = key(r);
    if (!k) continue;
    const e = m.get(k) ?? { key: k, total: 0, open: 0, breached: 0, resolved: 0 };
    e.total++;
    if (!isClosed(r.status)) e.open++;
    if (r.sla_breached) e.breached++;
    if (r.status === "resolved") e.resolved++;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** Рейтинг служб (ФИШКА 3 + подотчётность): просрочки, переоткрытия, ответы без конкретики, время */
export function serviceQuality(rs: BaseReport[]) {
  const m = new Map<string, BaseReport[]>();
  for (const r of rs) m.set(r.service, [...(m.get(r.service) ?? []), r]);
  return [...m.entries()]
    .map(([service, list]) => {
      const resolved = list.filter((r) => r.status === "resolved" && r.resolved_at);
      const replies = list.filter((r) => r.reply_boilerplate != null);
      const after = list.filter((r) => r.after_geo_verified != null);
      return {
        service,
        total: list.length,
        breachedShare: round1((100 * list.filter((r) => r.sla_breached).length) / list.length),
        reopenTotal: list.reduce((s, r) => s + r.reopen_count, 0),
        reopenShare: round1((100 * list.filter((r) => r.reopen_count > 0).length) / list.length),
        boilerShare: replies.length ? round1((100 * replies.filter((r) => r.reply_boilerplate! >= BOILERPLATE_THRESHOLD).length) / replies.length) : 0,
        unverifiedPhotoShare: after.length ? round1((100 * after.filter((r) => !r.after_geo_verified).length) / after.length) : 0,
        medianDays: round1(median(resolved.map((r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / DAY))),
      };
    })
    .sort((a, b) => b.total - a.total);
}
