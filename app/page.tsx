import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kpi } from "@/components/kpi";
import { CityMap } from "@/components/map/map";
import { LiveRefresh } from "@/components/live-refresh";
import { StatusBadge } from "@/components/status-badge";
import { getDict } from "@/lib/i18n/server";
import { flow, toMapPoint } from "@/lib/data";
import { kpis } from "@/lib/stats";
import { CATEGORY, DISTRICT, nm } from "@/lib/meta";

export default async function Home() {
  const [{ lang, t }, { all, real }] = await Promise.all([getDict(), flow()]);
  const k = kpis(all);
  const recent = real.slice(0, 6);
  const fmt = new Intl.NumberFormat("ru-RU");

  return (
    <>
      <LiveRefresh />
      <section className="mx-auto w-full max-w-7xl px-4 pt-8 pb-6 md:pt-14">
        <p className="text-sm font-medium text-primary">AIQYN · Ақтау · айқын</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">{t.tagline}</h1>
        <p className="mt-4 max-w-3xl text-muted-foreground text-pretty md:text-lg">{t.landing.pitch}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/report/new">
              <Plus /> {t.nav.report}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/map">
              {t.nav.map} <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-3 px-4 md:grid-cols-4">
        <Kpi label={t.landing.kpiTotal} value={fmt.format(k.total)} />
        <Kpi label={t.landing.kpiResolved} value={fmt.format(k.resolved)} tone="ok" />
        <Kpi label={t.landing.kpiBreached} value={fmt.format(k.breachedOpen)} tone="danger" />
        <Kpi label={t.landing.kpiMedian} value={k.medianDays} />
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">{t.landing.liveMap}</h2>
            <Link href="/map" className="text-sm text-primary hover:underline">
              {t.nav.map} →
            </Link>
          </div>
          <CityMap
            points={all.filter((r) => r.status !== "resolved" && r.status !== "rejected").map((r) => toMapPoint(r, lang))}
            className="h-[380px] w-full md:h-[460px]"
            statusLabels={t.status}
            demoLabel={t.map.demo}
            openLabel={t.map.open}
          />
        </div>
        <div className="rounded-lg border">
          <h2 className="border-b px-4 py-2.5 text-sm font-medium">{t.landing.recent}</h2>
          {recent.length ? (
            <ul className="divide-y">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/report/${r.public_no}`} className="block px-4 py-3 hover:bg-accent/50">
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-medium">{r.title}</span>
                      <StatusBadge status={r.status} label={t.status[r.status as keyof typeof t.status]} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.public_no} · {nm(CATEGORY[r.category], lang)}
                      {r.district ? ` · ${nm(DISTRICT[r.district], lang)}` : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              <Link href="/report/new" className="text-primary hover:underline">
                {t.nav.report} →
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-6">
        <h2 className="text-lg font-semibold">{t.landing.how}</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {t.landing.steps.map(([title, text], i) => (
            <li key={i} className="rounded-lg border bg-card p-4">
              <div className="text-xs font-medium text-primary tabular-nums">0{i + 1}</div>
              <div className="mt-1 font-medium">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm font-medium">{t.landing.notReplace}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t.landing.demoNote}</p>
      </section>
    </>
  );
}
