import Link from "next/link";
import { AlarmClock, ArrowRight, CheckCheck, FileText, Inbox, Layers, Map as MapIcon, ShieldAlert } from "lucide-react";
import { honestContext, honestForecast } from "@/lib/honest-deadline";
import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { flow, toMapPoint, titleOf } from "@/lib/data";
import { kpis, daily, byKey } from "@/lib/stats";
import { CATEGORY, DISTRICT, SERVICE, nm } from "@/lib/meta";
import { Kpi } from "@/components/kpi";
import { CityMap } from "@/components/map/map";
import { LiveRefresh } from "@/components/live-refresh";
import { AreaInteractive } from "@/components/akimat/area-interactive";
import { ReportsTable, type TableRow } from "@/components/akimat/reports-table";
import { BarList } from "@/components/akimat/bar-list";
import { PainRanking } from "@/components/akimat/pain-parts";
import { Button } from "@/components/ui/button";
import { painData } from "@/lib/pain-data";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.akimat };
}

const DAY = 86_400_000;
const OPEN = ["routed", "accepted", "in_progress", "reopened", "awaiting_confirmation"];

// Обзор акимата: плитки с трендом, динамика с переключателем периода, индекс боли и тепловая
// карта, разрезы по категориям и районам, таблица всех открытых обращений с риском срыва.
export default async function AkimatPage() {
  const [{ lang, t }, { all, real }, pain] = await Promise.all([getDict(), flow(), painData()]);
  const o = t.akimat.overview;
  const now = new Date();
  const k = kpis(all);
  const series = daily(all, 90);
  const cats = byKey(all, (r) => r.category).slice(0, 8);
  const dists = byKey(all, (r) => r.district).slice(0, 8);
  const n = new Intl.NumberFormat("ru-RU");

  // тренд: последние 7 дней к предыдущим 7
  const inWeek = (iso: string | null, from: number) => !!iso && now.getTime() - new Date(iso).getTime() >= from * DAY && now.getTime() - new Date(iso).getTime() < (from + 7) * DAY;
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);
  const created = [all.filter((r) => inWeek(r.created_at, 0)).length, all.filter((r) => inWeek(r.created_at, 7)).length];
  const resolved = [all.filter((r) => inWeek(r.resolved_at, 0)).length, all.filter((r) => inWeek(r.resolved_at, 7)).length];

  // честный прогноз для всех открытых — риск срыва в таблице и число «под угрозой»
  const hctx = honestContext(all);
  const open = all.filter((r) => OPEN.includes(r.status));
  const rows: TableRow[] = open.map((r) => {
    const f = r.sla_breached ? null : honestForecast(r, hctx, now);
    return {
      no: r.public_no,
      title: titleOf(r, lang),
      cat: nm(CATEGORY[r.category], lang),
      district: r.district && DISTRICT[r.district] ? nm(DISTRICT[r.district], lang) : "—",
      service: SERVICE[r.service]?.short ?? r.service,
      status: r.status,
      statusLabel: t.status[r.status as keyof typeof t.status] ?? r.status,
      due: r.sla_due_at,
      breached: r.sla_breached,
      risk: r.sla_breached ? 1 : f && f.ok ? f.pBreach : null,
      priority: r.priority,
    };
  });
  const atRisk = rows.filter((r) => !r.breached && (r.risk ?? 0) >= 0.5).length;

  return (
    <div className="flex flex-col gap-6">
      <LiveRefresh />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{o.kicker}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{t.nav.akimat}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tf(o.sub, { n: real.length })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="border-[color:var(--danger)]/40 text-[color:var(--danger)] hover:text-[color:var(--danger)]">
            <Link href="/akimat/risk">
              <ShieldAlert /> {o.toRisk} · {atRisk}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/akimat/digest">
              <FileText /> {t.digest.nav}
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/map">
              <MapIcon /> {o.toMap}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={o.kpiTotal} value={n.format(k.total)} hint={o.hintTotal} icon={<Layers />} trend={{ pct: pct(created[0], created[1]), good: false, label: o.trendWeek }} />
        <Kpi label={o.kpiOpen} value={n.format(k.open)} hint={o.hintOpen} icon={<Inbox />} />
        <Kpi label={o.kpiBreached} value={n.format(k.breachedOpen)} hint={o.hintBreached} tone="danger" icon={<AlarmClock />} />
        <Kpi label={o.kpiResolved} value={n.format(k.resolved)} hint={tf(o.hintResolved, { n: k.medianDays })} tone="ok" icon={<CheckCheck />} trend={{ pct: pct(resolved[0], resolved[1]), good: true, label: o.trendWeek }} />
      </div>

      <Link
        href="/akimat/risk"
        className="group flex items-center gap-4 rounded-xl border border-[color:var(--danger)]/35 bg-[linear-gradient(120deg,rgb(220_80_60/0.10),rgb(220_80_60/0)_70%)] p-4 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgb(120_30_20/0.45)]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color:var(--danger)]/12 text-[color:var(--danger)]">
          <ShieldAlert className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            <span className="text-[color:var(--danger)] tabular-nums">{n.format(atRisk)}</span> · {t.akimat.risk.kpiRisk.toLowerCase()}
          </span>
          <span className="block text-sm text-muted-foreground">{t.akimat.risk.sub}</span>
        </span>
        <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </Link>

      <AreaInteractive data={series} labels={{ title: o.chartTitle, sub: o.chartSub, created: o.created, resolved: o.resolved, range: o.range }} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t.pain.title}</h2>
            <Link href="/akimat/pain" className="text-sm text-primary hover:underline">{t.pain.all} →</Link>
          </div>
          <PainRanking rows={pain.rows} delta={pain.delta} lang={lang} t={t.pain} limit={6} />
        </section>
        <section className="overflow-hidden rounded-xl border bg-card">
          <h2 className="border-b px-4 py-2.5 font-semibold">{o.heat}</h2>
          <CityMap mode="heat" className="h-[340px] w-full" points={open.map((r) => toMapPoint(r, lang))} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{o.byCat}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{o.legendTotal} · <span className="text-[color:var(--danger)]">{o.legendBreached}</span></p>
          <BarList breachedLabel={o.breached} rows={cats.map((c) => ({ label: nm(CATEGORY[c.key], lang), total: c.total, breached: c.breached }))} />
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{o.byDist}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{o.legendTotal} · <span className="text-[color:var(--danger)]">{o.legendBreached}</span></p>
          <BarList breachedLabel={o.breached} rows={dists.map((d) => ({ label: nm(DISTRICT[d.key], lang), total: d.total, breached: d.breached }))} />
        </section>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">{o.tableTitle}</h2>
        <ReportsTable rows={rows} lang={lang} l={{ tabs: o.tabs, search: o.search, cols: o.cols, empty: o.empty, page: o.page }} />
      </div>
    </div>
  );
}
