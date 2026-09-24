import "server-only";
import { flow, titleOf } from "@/lib/data";
import { painIndex, painDelta } from "@/lib/pain-index";
import { flowClusters } from "@/lib/flow-clusters";
import { getReference } from "@/lib/reference";
import { createAdminClient } from "@/lib/supabase/admin";
import { honestContext, honestForecast } from "@/lib/honest-deadline";
import { CATEGORY, DISTRICT, SERVICE, nm } from "@/lib/meta";

// Дайджест для акима (ADDON_4): выжимка за период — только агрегаты из потока обращений и базы.
// Формулировки нейтральные: «сроки нарушены по N обращениям», а не «служба провалила работу».

const DAY = 86_400_000;
const OPEN = ["routed", "accepted", "in_progress", "reopened", "awaiting_confirmation"];

export type Digest = Awaited<ReturnType<typeof buildDigest>>;

export async function buildDigest(from: Date, to: Date, lang: "ru" | "kz") {
  const [{ all }, ref] = await Promise.all([flow(), getReference()]);
  const inP = (iso: string | null, a = from, b = to) => !!iso && new Date(iso) >= a && new Date(iso) < b;
  const len = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - len);

  const created = all.filter((r) => inP(r.created_at));
  const createdPrev = all.filter((r) => inP(r.created_at, prevFrom, from));
  const resolved = all.filter((r) => r.status === "resolved" && inP(r.resolved_at));
  // просрочено в периоде: законный срок истёк в периоде, а к сроку обращение не было решено
  const breached = all.filter((r) => r.sla_due_at && inP(r.sla_due_at) && r.status !== "rejected" && (!r.resolved_at || new Date(r.resolved_at) > new Date(r.sla_due_at)));
  const reopened = all.filter((r) => r.reopen_count > 0 && (inP(r.created_at) || inP(r.resolved_at) || OPEN.includes(r.status)) && r.status === "reopened");
  const avgDays = resolved.length ? resolved.reduce((s, r) => s + (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / DAY, 0) / resolved.length : null;

  // службы с просрочками: сколько и насколько в среднем превышен срок
  const bySvc = new Map<string, { n: number; over: number }>();
  for (const r of breached) {
    const end = r.resolved_at ? new Date(r.resolved_at).getTime() : to.getTime();
    const over = Math.max(0, (end - new Date(r.sla_due_at!).getTime()) / DAY);
    const e = bySvc.get(r.service) ?? { n: 0, over: 0 };
    e.n++;
    e.over += over;
    bySvc.set(r.service, e);
  }
  const services = [...bySvc]
    .map(([code, v]) => ({ name: SERVICE[code]?.short ?? code, full: nm(SERVICE[code], lang), n: v.n, avgOver: Math.round(v.over / v.n) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);

  // индекс боли на конец периода и изменение за 30 дней
  const districts = ref.districts.filter((d) => d.kind !== "zone").map((d) => ({ code: d.code, population: d.population }));
  const pain = painIndex(all, districts, to.getTime());
  const delta = painDelta(all, districts, to.getTime());
  const painTop = pain
    .filter((r) => !r.insufficient && r.index != null && DISTRICT[r.district])
    .slice(0, 5)
    .map((r) => ({ name: nm(DISTRICT[r.district], lang), index: r.index!, delta: delta(r.district) }));

  // раннее предупреждение: открытые, которые по прогнозу не уложатся в срок в ближайшие 7 дней
  const hctx = honestContext(all);
  const atRisk = all
    .filter((r) => OPEN.includes(r.status) && !r.sla_breached && r.sla_due_at && new Date(r.sla_due_at).getTime() - to.getTime() < 7 * DAY && new Date(r.sla_due_at) > to)
    .map((r) => ({ r, f: honestForecast(r, hctx, to) }))
    .filter((v) => v.f.ok && (v.f.pBreach ?? 0) >= 0.5)
    .sort((a, b) => (b.f.ok ? b.f.pBreach ?? 0 : 0) - (a.f.ok ? a.f.pBreach ?? 0 : 0));
  const riskList = atRisk.slice(0, 6).map(({ r, f }) => ({
    no: r.public_no,
    title: titleOf(r, lang),
    district: r.district && DISTRICT[r.district] ? nm(DISTRICT[r.district], lang) : "—",
    service: SERVICE[r.service]?.short ?? r.service,
    due: r.sla_due_at!,
    p: f.ok ? Math.round((f.pBreach ?? 0) * 100) : 0,
  }));

  // хронические точки
  const chronic = flowClusters(all)
    .filter((c) => c.chronic_score >= 0.5)
    .slice(0, 4)
    .map((c) => ({
      label: c.label ?? (c.members[0] ? (lang === "kz" && c.members[0].title_kz ? c.members[0].title_kz : c.members[0].title) : ""),
      district: c.district && DISTRICT[c.district] ? nm(DISTRICT[c.district], lang) : "—",
      category: nm(CATEGORY[c.category], lang),
      count: c.count,
      reopen: c.reopen_total,
      since: c.first_seen,
    }));

  // сопоставление с закупками (со ссылками на первоисточник)
  const { data: contracts } = await createAdminClient().from("procurements").select("title, amount_kzt, district_id, source_url, raw");
  const money = new Map<string, { sum: number; url: string | null }>();
  for (const c of contracts ?? []) {
    const code = c.district_id ? ref.districtById.get(c.district_id)?.code : null;
    if (!code) continue;
    const e = money.get(code) ?? { sum: 0, url: c.source_url };
    e.sum += Number(c.amount_kzt ?? 0);
    money.set(code, e);
  }
  const modelMoney = (contracts ?? []).some((c) => (c.raw as { model?: boolean } | null)?.model);
  const periodByDistrict = new Map<string, { n: number; br: number }>();
  for (const r of created) {
    if (!r.district) continue;
    const e = periodByDistrict.get(r.district) ?? { n: 0, br: 0 };
    e.n++;
    if (r.sla_breached) e.br++;
    periodByDistrict.set(r.district, e);
  }
  const procurement = [...money]
    .map(([code, m]) => ({ name: DISTRICT[code] ? nm(DISTRICT[code], lang) : code, mln: m.sum / 1e6, url: m.url, n: periodByDistrict.get(code)?.n ?? 0, br: periodByDistrict.get(code)?.br ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n / b.mln - a.n / a.mln || b.n - a.n)
    .slice(0, 3);

  const breachedList = breached
    .filter((r) => OPEN.includes(r.status))
    .map((r) => ({
      no: r.public_no,
      title: titleOf(r, lang),
      district: r.district && DISTRICT[r.district] ? nm(DISTRICT[r.district], lang) : "—",
      service: SERVICE[r.service]?.short ?? r.service,
      over: Math.max(1, Math.round((to.getTime() - new Date(r.sla_due_at!).getTime()) / DAY)),
    }))
    .sort((a, b) => b.over - a.over)
    .slice(0, 14);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    generated: new Date().toISOString(),
    enough: created.length >= 5,
    kpi: {
      created: created.length,
      createdDelta: createdPrev.length ? Math.round(((created.length - createdPrev.length) / createdPrev.length) * 100) : null,
      resolved: resolved.length,
      breached: breached.length,
      reopened: reopened.length,
      avgDays: avgDays == null ? null : Math.round(avgDays * 10) / 10,
      atRisk: atRisk.length,
    },
    services,
    painTop,
    riskList,
    chronic,
    procurement,
    modelMoney,
    breachedList,
  };
}
