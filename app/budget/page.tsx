import Link from "next/link";
import { AlarmClock, ArrowUpRight, CircleDollarSign, Download, Landmark, MapPin, Users } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dict";
import { buildDemand } from "@/lib/budget-demand";
import { Kpi } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.budget.title };
}

const OPEN_BUDGETS = "https://budget.egov.kz/";
const BNU_AKTAU = "https://www.gov.kz/memleket/entities/akimat-goroda-aktau/bnu/157?lang=ru";

// Публичная страница: жалобы по направлениям бюджета — аргументы для маслихата и жителей
export default async function BudgetPage() {
  const { lang, t } = await getDict();
  const b = t.budget;
  const d = await buildDemand(lang);
  const n = new Intl.NumberFormat("ru-RU");
  const mln = (x: number) => n.format(Math.round(x));
  const maxN = Math.max(1, ...d.directions.map((x) => x.n));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{b.kicker}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{b.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">{b.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/api/documents/budget-demand?lang=${lang}&view=1`} target="_blank" rel="noopener noreferrer">
              <ArrowUpRight /> PDF
            </a>
          </Button>
          <Button asChild className="btn-shine">
            <a href={`/api/documents/budget-demand?lang=${lang}`}>
              <Download /> {b.pdf}
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={fmt(b.kpiTotal, { d: d.days })} value={n.format(d.kpi.total)} icon={<Landmark />} />
        <Kpi label={b.kpiPeople} value={n.format(d.kpi.people)} icon={<Users />} />
        <Kpi label={b.kpiBreached} value={`${d.kpi.breachedPct}%`} hint={n.format(d.kpi.breached)} tone="danger" icon={<AlarmClock />} />
        <Kpi label={b.kpiChronic} value={n.format(d.kpi.chronic)} tone="warn" icon={<MapPin />} />
      </div>

      <section className="rounded-xl border-2 border-[color:var(--danger)]/35 bg-[linear-gradient(120deg,rgb(220_80_60/0.08),rgb(220_80_60/0)_65%)] p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--danger)]/12 text-[color:var(--danger)]">
            <CircleDollarSign className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">{fmt(b.stuckTitle, { n: d.stuck.total })}</h2>
            <p className="text-xs text-muted-foreground text-pretty">{b.stuckSub}</p>
          </div>
        </div>
        {d.stuck.byDir.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {d.stuck.byDir.map((x) => (
              <li key={x.code} className="rounded-lg border bg-card px-3 py-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{x.name}</span>
                  <span className="font-semibold tabular-nums text-[color:var(--danger)]">{x.n}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmt(b.stuckRow, { a: x.noFunding, b: x.procurement })} · {x.top.map((p) => `${p.name} (${p.n})`).join(", ")}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{b.stuckNone}</p>
        )}
      </section>

      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">{b.dirTitle}</h2>
          <p className="text-xs text-muted-foreground">{b.dirSub}</p>
        </div>
        <ul className="divide-y">
          {d.directions.map((x) => (
            <li key={x.code} className="grid gap-2 px-4 py-3 md:grid-cols-[15rem_1fr_auto] md:items-center md:gap-4">
              <div className="min-w-0">
                <div className="font-medium">{x.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {b.where}: {x.top.map((p) => `${p.name} (${p.n})`).join(", ") || b.none}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-primary/70" style={{ width: `${(x.n / maxN) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--danger)]" style={{ width: `${(x.breached / maxN) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-sm font-semibold tabular-nums">{n.format(x.n)}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground md:justify-end">
                <span>
                  {b.colBr}: <b className="text-[color:var(--danger)] tabular-nums">{x.breachedPct}%</b>
                </span>
                <span>
                  {b.colRe}: <b className="text-foreground tabular-nums">{x.reopened}</b>
                </span>
                <span>
                  {b.colMoney}: <b className="text-foreground tabular-nums">{x.mln ? mln(x.mln) : b.none}</b>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: b.needTitle, sub: b.needSub, rows: d.need.map((r) => ({ key: r.code, name: r.name, text: fmt(b.rowNeed, { n: r.n, b: r.br, m: mln(r.mln) }), url: null as string | null })), tone: "border-[color:var(--danger)]/35" },
          { title: b.paidTitle, sub: b.paidSub, rows: d.paid.map((r) => ({ key: r.code, name: r.name, text: fmt(b.rowPaid, { m: mln(r.mln), n: r.n, r: r.re }), url: r.url })), tone: "border-[color:var(--warn)]/45" },
        ].map((box) => (
          <section key={box.title} className={cn("rounded-xl border-2 bg-card p-4", box.tone)}>
            <h2 className="font-semibold">{box.title}</h2>
            <p className="mb-3 text-xs text-muted-foreground text-pretty">{box.sub}</p>
            <ul className="flex flex-col gap-2.5 text-sm">
              {box.rows.map((r) => (
                <li key={r.key} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">{r.text}</span>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      goszakup ↗
                    </a>
                  )}
                </li>
              ))}
              {box.rows.length === 0 && <li className="text-muted-foreground">{b.none}</li>}
            </ul>
          </section>
        ))}
      </div>

      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-semibold">{b.initTitle}</h2>
            <p className="text-xs text-muted-foreground">{b.initSub}</p>
          </div>
          <Link href="/initiatives" className="text-sm text-primary hover:underline">
            {t.initiatives.title} →
          </Link>
        </div>
        <ol className="mt-3 flex flex-col gap-2 text-sm">
          {d.initiatives.map((i, k) => (
            <li key={i.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="w-5 text-muted-foreground tabular-nums">{k + 1}.</span>
              <Link href={`/initiatives#i-${i.id}`} className="font-medium hover:underline">
                {i.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {[i.district, `${n.format(i.votes)} ${b.votes}`, i.fromReport ? fmt(b.fromReport, { no: i.fromReport }) : null].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
          {d.initiatives.length === 0 && <li className="text-muted-foreground">{b.none}</li>}
        </ol>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">{b.howTitle}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {b.how.map(([h, p], i) => (
            <div key={h} className="flex gap-3 rounded-xl border bg-card p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
              <div>
                <div className="font-medium">{h}</div>
                <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{p}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={OPEN_BUDGETS} target="_blank" rel="noopener noreferrer">
              {b.openBudgets} <ArrowUpRight />
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={BNU_AKTAU} target="_blank" rel="noopener noreferrer">
              {b.bnu} <ArrowUpRight />
            </a>
          </Button>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">{b.modelNote}</p>
    </div>
  );
}
