import Link from "next/link";
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

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.akimat };
}

export default async function AkimatPage() {
  const [{ lang, t }, { all, real }] = await Promise.all([getDict(), flow()]);
  const k = kpis(all);
  const series = daily(all, 90);
  const cats = byKey(all, (r) => r.category).slice(0, 10);
  const dists = byKey(all, (r) => r.district).slice(0, 12);
  const overdue = all
    .filter((r) => r.sla_breached && !["resolved", "rejected"].includes(r.status))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);
  const fmt = new Intl.NumberFormat("ru-RU");

  return (
    <div className="flex flex-col gap-6">
      <LiveRefresh />
      <div>
        <h1 className="text-xl font-semibold">{t.nav.akimat}</h1>
        <p className="text-sm text-muted-foreground">{tf(t.akimat.overview.sub, { n: real.length })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label={t.akimat.overview.kpiTotal} value={fmt.format(k.total)} hint={tf(t.akimat.overview.last7, { n: k.last7 })} />
        <Kpi label={t.akimat.overview.kpiOpen} value={fmt.format(k.open)} />
        <Kpi label={t.akimat.overview.kpiBreached} value={fmt.format(k.breachedOpen)} tone="danger" />
        <Kpi label={t.akimat.overview.kpiAwaiting} value={fmt.format(k.awaiting)} tone="warn" />
        <Kpi label={t.akimat.overview.kpiReopened} value={fmt.format(k.reopened)} />
        <Kpi label={t.akimat.overview.kpiMedian} value={k.medianDays} />
      </div>

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
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className="w-10 font-semibold tabular-nums">{Math.round(r.priority)}</span>
              {r.demo ? (
                <span className="min-w-0 flex-1 truncate">{titleOf(r, lang)}</span>
              ) : (
                <Link href={`/report/${r.public_no}`} className="min-w-0 flex-1 truncate text-primary hover:underline">{r.title}</Link>
              )}
              <span className="text-xs text-muted-foreground">
                {nm(DISTRICT[r.district ?? ""], lang)} · {SERVICE[r.service]?.short}
                {r.demo && ` · ${t.akimat.demo}`}
              </span>
              <StatusBadge status={r.status} label={t.status[r.status as keyof typeof t.status]} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
