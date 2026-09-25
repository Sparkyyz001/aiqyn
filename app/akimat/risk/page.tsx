import Link from "next/link";
import { AlarmClock, CalendarClock, ShieldAlert, Sigma } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { flow, titleOf } from "@/lib/data";
import { honestContext, honestForecast, honestMetrics } from "@/lib/honest-deadline";
import { CATEGORY, DISTRICT, SERVICE, nm, isInWork } from "@/lib/meta";
import { Kpi } from "@/components/kpi";
import { LiveRefresh } from "@/components/live-refresh";
import { BarList } from "@/components/akimat/bar-list";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.akimat.risk.title };
}

const DAY = 86_400_000;

// «Заявки под угрозой срыва» — раннее предупреждение для диспетчера акимата:
// та же модель «Честного срока», но с другой стороны — какие открытые заявки не успеют
// в законный срок, если ничего не менять. Сортировка по вероятности срыва.
export default async function RiskPage() {
  const [{ lang, t }, { all }] = await Promise.all([getDict(), flow()]);
  const r = t.akimat.risk;
  const now = new Date();
  const ctx = honestContext(all);

  const open = all.filter((x) => isInWork(x.status) && x.sla_due_at);
  const already = open.filter((x) => new Date(x.sla_due_at!).getTime() < now.getTime());
  const ahead = open
    .filter((x) => new Date(x.sla_due_at!).getTime() >= now.getTime())
    .map((x) => ({ x, f: honestForecast(x, ctx, now) }))
    .filter((v): v is { x: (typeof open)[number]; f: Extract<ReturnType<typeof honestForecast>, { ok: true }> } => v.f.ok && v.f.pBreach != null);

  const atRisk = ahead.filter((v) => v.f.pBreach! >= 0.5);
  const week = ahead.filter((v) => new Date(v.x.sla_due_at!).getTime() - now.getTime() < 7 * DAY);
  const expected = ahead.reduce((s, v) => s + v.f.pBreach!, 0);
  const list = [...ahead].sort((a, b) => b.f.pBreach! - a.f.pBreach! || +new Date(a.x.sla_due_at!) - +new Date(b.x.sla_due_at!)).slice(0, 40);

  const svc = new Map<string, { total: number; risk: number }>();
  for (const v of ahead) {
    const s = svc.get(v.x.service) ?? { total: 0, risk: 0 };
    s.total++;
    if (v.f.pBreach! >= 0.5) s.risk++;
    svc.set(v.x.service, s);
  }
  const bySvc = [...svc].sort((a, b) => b[1].risk - a[1].risk).map(([code, v]) => ({ label: nm(SERVICE[code], lang) || code, total: v.total, breached: v.risk }));

  const d = (iso: string) => new Date(iso).toLocaleDateString(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Aqtau" });
  const n = new Intl.NumberFormat("ru-RU");

  return (
    <div className="flex flex-col gap-6">
      <LiveRefresh />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{r.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{r.sub}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={r.kpiRisk} value={n.format(atRisk.length)} tone="danger" icon={<ShieldAlert />} />
        <Kpi label={r.kpiWeek} value={n.format(week.length)} tone="warn" icon={<CalendarClock />} />
        <Kpi label={r.kpiExpected} value={n.format(Math.round(expected))} icon={<Sigma />} />
        <Kpi label={r.kpiAlready} value={n.format(already.length)} icon={<AlarmClock />} />
      </div>

      <p className="rounded-xl border border-[#075458]/25 bg-[#075458]/[0.05] px-4 py-3 text-sm text-pretty dark:border-[#4fb3a9]/25 dark:bg-[#4fb3a9]/[0.07]">{r.frame}</p>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-xl border">
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_6rem_6rem_7rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground md:grid">
            <span>{r.colReport}</span>
            <span>{r.colService}</span>
            <span>{r.colDue}</span>
            <span>{r.colForecast}</span>
            <span className="text-right">{r.colP}</span>
          </div>
          {list.length === 0 && <p className="p-4 text-sm text-muted-foreground">{r.empty}</p>}
          <ul className="divide-y">
            {list.map(({ x, f }) => {
              const p = Math.round(f.pBreach! * 100);
              return (
                <li key={x.id}>
                  <Link
                    href={`/report/${x.public_no}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-sm transition-colors hover:bg-accent/50 md:grid-cols-[minmax(0,1fr)_7rem_6rem_6rem_7rem]"
                  >
                    <span className="min-w-0">
                      <span className="line-clamp-1 font-medium">{titleOf(x, lang)}</span>
                      <span className="text-xs text-muted-foreground">
                        {nm(CATEGORY[x.category], lang)}
                        {x.district && DISTRICT[x.district] ? ` · ${nm(DISTRICT[x.district], lang)}` : ""}
                      </span>
                    </span>
                    <span className="hidden truncate text-xs md:block">{SERVICE[x.service]?.short ?? x.service}</span>
                    <span className="hidden tabular-nums md:block">{d(x.sla_due_at!)}</span>
                    <span className={cn("hidden tabular-nums md:block", (f.lateBy ?? 0) > 1 && "text-[color:var(--danger)]")}>{d(f.date)}</span>
                    <span className="row-span-2 flex items-center justify-end gap-2 md:row-span-1">
                      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block">
                        <span className={cn("block h-full rounded-full", p >= 50 ? "bg-[color:var(--danger)]" : p >= 30 ? "bg-[color:var(--warn)]" : "bg-[color:var(--ok)]")} style={{ width: `${p}%` }} />
                      </span>
                      <span className={cn("w-10 text-right font-semibold tabular-nums", p >= 50 ? "text-[color:var(--danger)]" : p >= 30 ? "text-[color:var(--warn)]" : "")}>{p}%</span>
                    </span>
                    <span className="text-xs text-muted-foreground md:hidden">
                      {r.colDue}: {d(x.sla_due_at!)} · {r.colForecast}: {d(f.date)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border p-4">
            <h2 className="font-medium">{r.byService}</h2>
            <p className="mb-4 text-xs text-muted-foreground">{r.bySub}</p>
            <BarList rows={bySvc} breachedLabel={r.kpiRisk} />
          </section>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {tf(r.model, {
              rows: n.format(honestMetrics.train_rows + honestMetrics.test_rows),
              pct: Math.round(honestMetrics.improvement_vs_official_pct),
              auc: honestMetrics.breach_auc.model.toFixed(2),
            })}
          </p>
        </aside>
      </div>
    </div>
  );
}
