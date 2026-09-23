import Link from "next/link";
import { AlarmClock, ArrowRight, CheckCheck, Inbox, Layers, RotateCcw, ShieldAlert, Timer } from "lucide-react";
import { honestContext, honestForecast } from "@/lib/honest-deadline";
import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { flow, toMapPoint, titleOf } from "@/lib/data";
import { kpis, daily, byKey } from "@/lib/stats";
import { CATEGORY, DISTRICT, SERVICE, nm } from "@/lib/meta";
import { Kpi } from "@/components/kpi";
import { CityMap } from "@/components/map/map";
import { LiveRefresh } from "@/components/live-refresh";
import { DailyChart } from "@/components/akimat/daily-chart";
import { BarList } from "@/components/akimat/bar-list";
import { StatusBadge } from "@/components/status-badge";
import { PainRanking } from "@/components/akimat/pain-parts";
import { painData } from "@/lib/pain-data";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.akimat };
}

export default async function AkimatPage() {
  const [{ lang, t }, { all, real }, pain] = await Promise.all([getDict(), flow(), painData()]);
  const k = kpis(all);
  const series = daily(all, 90);
  const cats = byKey(all, (r) => r.category).slice(0, 10);
  const dists = byKey(all, (r) => r.district).slice(0, 12);
  const overdue = all
    .filter((r) => r.sla_breached && !["resolved", "rejected"].includes(r.status))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);
  const fmt = new Intl.NumberFormat("ru-RU");
  // Раннее предупреждение: сколько открытых заявок, по прогнозу, не уложится в законный срок
  const hctx = honestContext(all);
  const now = new Date();
  const atRisk = all.filter((r) => {
    if (!["routed", "accepted", "in_progress", "reopened"].includes(r.status) || !r.sla_due_at || new Date(r.sla_due_at) < now) return false;
    const f = honestForecast(r, hctx, now);
    return f.ok && (f.pBreach ?? 0) >= 0.5;
  }).length;

  return (
    <div className="flex flex-col gap-6">
      <LiveRefresh />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.nav.akimat}</h1>
        <p className="text-sm text-muted-foreground">{tf(t.akimat.overview.sub, { n: real.length })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label={t.akimat.overview.kpiTotal} value={fmt.format(k.total)} hint={tf(t.akimat.overview.last7, { n: k.last7 })} icon={<Layers />} />
        <Kpi label={t.akimat.overview.kpiOpen} value={fmt.format(k.open)} icon={<Inbox />} />
        <Kpi label={t.akimat.overview.kpiBreached} value={fmt.format(k.breachedOpen)} tone="danger" icon={<AlarmClock />} />
        <Kpi label={t.akimat.overview.kpiAwaiting} value={fmt.format(k.awaiting)} tone="warn" icon={<CheckCheck />} />
        <Kpi label={t.akimat.overview.kpiReopened} value={fmt.format(k.reopened)} icon={<RotateCcw />} />
        <Kpi label={t.akimat.overview.kpiMedian} value={k.medianDays} icon={<Timer />} />
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
            <span className="text-[color:var(--danger)] tabular-nums">{fmt.format(atRisk)}</span> · {t.akimat.risk.kpiRisk.toLowerCase()}
          </span>
          <span className="block text-sm text-muted-foreground">{t.akimat.risk.title}</span>
        </span>
        <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </Link>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">{t.pain.title}</h2>
          <Link href="/akimat/pain" className="text-sm text-primary hover:underline">{t.pain.all} →</Link>
        </div>
        <p className="text-sm text-muted-foreground">{t.pain.pitch}</p>
        <PainRanking rows={pain.rows} delta={pain.delta} lang={lang} t={t.pain} limit={5} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">{t.akimat.overview.dynamics}</h2>
          <DailyChart data={series} labels={{ created: t.akimat.overview.created, resolved: t.akimat.overview.resolved }} />
        </section>
        <section className="overflow-hidden rounded-lg border">
          <h2 className="border-b px-4 py-2.5 font-medium">{t.akimat.overview.heat}</h2>
          <CityMap
            mode="heat"
            className="h-[300px] w-full"
            points={all.filter((r) => !["resolved", "rejected"].includes(r.status)).map((r) => toMapPoint(r, lang))}
          />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="font-medium">{t.akimat.overview.byCat}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{t.akimat.overview.legendTotal} · <span className="text-[color:var(--danger)]">{t.akimat.overview.legendBreached}</span></p>
          <BarList breachedLabel={t.akimat.overview.breached} rows={cats.map((c) => ({ label: nm(CATEGORY[c.key], lang), total: c.total, breached: c.breached }))} />
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="font-medium">{t.akimat.overview.byDist}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{t.akimat.overview.legendTotal} · <span className="text-[color:var(--danger)]">{t.akimat.overview.legendBreached}</span></p>
          <BarList breachedLabel={t.akimat.overview.breached} rows={dists.map((d) => ({ label: nm(DISTRICT[d.key], lang), total: d.total, breached: d.breached }))} />
        </section>
      </div>

      <section className="rounded-lg border">
        <h2 className="border-b px-4 py-2.5 font-medium">{t.akimat.overview.topOverdue}</h2>
        <ul className="divide-y">
          {overdue.map((r) => (
            <li key={r.id} className="grid grid-cols-[2.5rem_1fr] items-start gap-x-3 gap-y-1 px-4 py-2.5 text-sm sm:grid-cols-[2.5rem_1fr_auto_auto] sm:items-center">
              <span className="row-span-2 font-semibold tabular-nums sm:row-span-1">{Math.round(r.priority)}</span>
              {r.demo ? (
                <span className="line-clamp-2 min-w-0">{titleOf(r, lang)}</span>
              ) : (
                <Link href={`/report/${r.public_no}`} className="line-clamp-2 min-w-0 text-primary hover:underline">{r.title}</Link>
              )}
              <span className="text-xs text-muted-foreground">
                {nm(DISTRICT[r.district ?? ""], lang)} · {SERVICE[r.service]?.short}
                {r.demo && ` · ${t.akimat.demo}`}
              </span>
              <StatusBadge status={r.status} label={t.status[r.status as keyof typeof t.status]} className="col-start-2 w-fit sm:col-start-auto" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
