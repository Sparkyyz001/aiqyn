import "server-only";
import { flow } from "@/lib/data";
import { flowClusters } from "@/lib/flow-clusters";
import { getReference } from "@/lib/reference";
import { createAdminClient } from "@/lib/supabase/admin";
import { DISTRICT, nm, isInWork } from "@/lib/meta";
import { MONEY_REASONS } from "@/lib/delay";

// «Народный заказ к бюджету»: жалобы жителей, сведённые по направлениям местного бюджета.
// Службы работают на деньги, которые выделяет акимат, а бюджет утверждает маслихат, —
// значит, спор «нет денег» решается при принятии бюджета. Документ даёт депутатам и жителям
// факты для этого спора: где жалоб много и сроки срываются, сколько туда уже законтрактовано,
// где контракты есть, а жалобы остались. Только агрегаты, без оценок людей и организаций.

const DAY = 86_400_000;

export const DIRECTIONS = [
  { code: "roads", cats: ["road_pit", "excavation"], ru: "Ремонт и содержание дорог", kz: "Жолдарды жөндеу және күтіп-ұстау" },
  { code: "water", cats: ["water_outage", "sewage"], ru: "Водоснабжение и канализация", kz: "Сумен жабдықтау және кәріз" },
  { code: "yards", cats: ["yard", "beach"], ru: "Благоустройство дворов и набережной", kz: "Аулалар мен жағалауды абаттандыру" },
  { code: "light", cats: ["lighting", "power_outage"], ru: "Освещение и электроснабжение", kz: "Жарықтандыру және электрмен жабдықтау" },
  { code: "sanitation", cats: ["garbage", "smell"], ru: "Санитария, вывоз мусора, экология", kz: "Санитария, қоқыс шығару, экология" },
  { code: "heat", cats: ["heating"], ru: "Теплоснабжение", kz: "Жылумен жабдықтау" },
  { code: "transport", cats: ["transport"], ru: "Общественный транспорт", kz: "Қоғамдық көлік" },
] as const;

const dirOf = (cat: string) => DIRECTIONS.find((d) => (d.cats as readonly string[]).includes(cat))?.code ?? null;

export type Demand = Awaited<ReturnType<typeof buildDemand>>;

export async function buildDemand(lang: "ru" | "kz", now = new Date()) {
  const db = createAdminClient();
  const [{ all }, ref, { data: contracts }, { data: inits }] = await Promise.all([
    flow(),
    getReference(),
    db.from("procurements").select("title, amount_kzt, district_id, category_hint, source_url, signed_at, raw"),
    db.from("initiatives").select("id, title, title_kz, votes_count, status, district_id, report_no").in("status", ["voting", "review", "planned"]).order("votes_count", { ascending: false }).limit(8),
  ]);
  // окно — последние 90 дней: столько же, сколько видно на карте и в аналитике
  const days = 90;
  const reports = all.filter((r) => r.status !== "rejected" && now.getTime() - new Date(r.created_at).getTime() <= days * DAY);
  const dName = (code: string | null) => (code && DISTRICT[code] ? nm(DISTRICT[code], lang) : "—");

  // деньги по контрактам: по направлению и по району
  const list = contracts ?? [];
  const modelMoney = list.some((c) => (c.raw as { model?: boolean } | null)?.model);
  const moneyDir = new Map<string, number>();
  const moneyDist = new Map<string, { sum: number; url: string | null; signed: string | null }>();
  for (const c of list) {
    const amt = Number(c.amount_kzt ?? 0);
    const dir = c.category_hint ? dirOf(c.category_hint) : null;
    if (dir) moneyDir.set(dir, (moneyDir.get(dir) ?? 0) + amt);
    const code = c.district_id ? ref.districtById.get(c.district_id)?.code : null;
    if (code) {
      const e = moneyDist.get(code) ?? { sum: 0, url: c.source_url, signed: c.signed_at };
      e.sum += amt;
      if (c.signed_at && (!e.signed || c.signed_at > e.signed)) e.signed = c.signed_at;
      moneyDist.set(code, e);
    }
  }

  // хронические адреса — по направлению
  const chronic = flowClusters(all).filter((c) => c.chronic_score >= 0.5);

  const directions = DIRECTIONS.map((d) => {
    const rs = reports.filter((r) => (d.cats as readonly string[]).includes(r.category));
    const breached = rs.filter((r) => r.sla_breached).length;
    const reopened = rs.filter((r) => r.reopen_count > 0).length;
    const people = rs.reduce((s, r) => s + 1 + (r.confirmations ?? 0), 0);
    const byD = new Map<string, number>();
    for (const r of rs) if (r.district) byD.set(r.district, (byD.get(r.district) ?? 0) + 1);
    const top = [...byD].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([code, n]) => ({ name: dName(code), n }));
    return {
      code: d.code,
      name: lang === "kz" ? d.kz : d.ru,
      n: rs.length,
      people,
      breached,
      breachedPct: rs.length ? Math.round((breached / rs.length) * 100) : 0,
      reopened,
      chronic: chronic.filter((c) => (d.cats as readonly string[]).includes(c.category)).length,
      mln: (moneyDir.get(d.code) ?? 0) / 1e6,
      top,
    };
  })
    .filter((d) => d.n > 0)
    .sort((a, b) => b.n - a.n);

  // районы: жалобы и контракты рядом
  const byDist = new Map<string, { n: number; br: number; re: number }>();
  for (const r of reports) {
    if (!r.district || !DISTRICT[r.district]) continue;
    const e = byDist.get(r.district) ?? { n: 0, br: 0, re: 0 };
    e.n++;
    if (r.sla_breached) e.br++;
    if (r.reopen_count > 0) e.re++;
    byDist.set(r.district, e);
  }
  const rows = [...byDist].map(([code, v]) => ({ code, name: dName(code), ...v, mln: (moneyDist.get(code)?.sum ?? 0) / 1e6, url: moneyDist.get(code)?.url ?? null, signed: moneyDist.get(code)?.signed ?? null }));
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1] ?? 0;
  const withMoney = rows.filter((r) => r.mln > 0);
  const mM = med(withMoney.map((r) => r.mln));
  const mN = med(rows.map((r) => r.n));
  // «Нужны средства»: жалоб больше медианы, денег по контрактам заметно меньше медианы
  const need = rows.filter((r) => r.n > mN && r.mln < mM * 0.6).sort((a, b) => b.n - a.n).slice(0, 6);
  // «Контракты есть — жалобы остались»: и денег, и жалоб больше медианы, есть переоткрытия
  const paid = rows.filter((r) => r.mln > mM && r.n > mN).sort((a, b) => b.re + b.br - (a.re + a.br)).slice(0, 6);

  // застряло из-за денег: открытые обращения, где служба указала «нет финансирования» или «ждём закупку»
  const stuck = reports.filter((r) => isInWork(r.status) && r.delay_reason && MONEY_REASONS.includes(r.delay_reason));
  const stuckByDir = DIRECTIONS.map((d) => {
    const rs = stuck.filter((r) => (d.cats as readonly string[]).includes(r.category));
    const byD = new Map<string, number>();
    for (const r of rs) if (r.district) byD.set(r.district, (byD.get(r.district) ?? 0) + 1);
    return {
      code: d.code,
      name: lang === "kz" ? d.kz : d.ru,
      n: rs.length,
      noFunding: rs.filter((r) => r.delay_reason === "no_funding").length,
      procurement: rs.filter((r) => r.delay_reason === "procurement").length,
      top: [...byD].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([code, n]) => ({ name: dName(code), n })),
    };
  })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  const initiatives = (inits ?? []).map((i) => ({
    id: i.id,
    title: lang === "kz" && i.title_kz ? i.title_kz : i.title,
    votes: i.votes_count,
    status: i.status,
    district: i.district_id ? (lang === "kz" ? ref.districtById.get(i.district_id)?.name_kz : ref.districtById.get(i.district_id)?.name_ru) ?? null : null,
    fromReport: i.report_no,
  }));

  const total = reports.length;
  const breached = reports.filter((r) => r.sla_breached).length;
  return {
    generated: now.toISOString(),
    days,
    kpi: {
      total,
      breached,
      breachedPct: total ? Math.round((breached / total) * 100) : 0,
      people: reports.reduce((s, r) => s + 1 + (r.confirmations ?? 0), 0),
      chronic: chronic.length,
      mln: list.reduce((s, c) => s + Number(c.amount_kzt ?? 0), 0) / 1e6,
      // лот, поделённый между микрорайонами, — это несколько строк; считаем уникальные лоты
      lots: new Set(list.map((c) => (c.raw as { lot_no?: string } | null)?.lot_no ?? c.title)).size,
    },
    directions,
    stuck: { total: stuck.length, byDir: stuckByDir },
    need,
    paid,
    initiatives,
    modelMoney,
  };
}
