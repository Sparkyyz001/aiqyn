import Link from "next/link";
import { AlarmClock, CheckCheck, Inbox, RotateCcw, ShieldAlert, Timer, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dict";
import { getReference } from "@/lib/reference";
import { listReports } from "@/lib/queries";
import { recomputeReport } from "@/lib/report-engine";
import { flow, titleOf, type FlowReport } from "@/lib/data";
import { serviceQuality } from "@/lib/stats";
import { honestContext, honestForecast } from "@/lib/honest-deadline";
import { CATEGORY, DISTRICT, nm } from "@/lib/meta";
import { LiveRefresh } from "@/components/live-refresh";
import { Kpi } from "@/components/kpi";
import { SlaTimer } from "@/components/reports/sla-timer";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.service.title };
}

// Колонки доски — этапы жизни обращения у службы
const COLUMNS = [
  { key: "new", statuses: ["new", "routed", "reopened"], tone: "border-t-[#5aa9e6]" },
  { key: "accepted", statuses: ["accepted"], tone: "border-t-primary" },
  { key: "work", statuses: ["in_progress"], tone: "border-t-[color:var(--warn)]" },
  { key: "await", statuses: ["awaiting_confirmation"], tone: "border-t-[color:var(--ok)]" },
] as const;
const PER_COLUMN = 12;

export default async function ServicePage({ searchParams }: PageProps<"/service">) {
  const me = await requireRole("service", "akimat", "operator");
  const [{ lang, t }, ref, sp] = await Promise.all([getDict(), getReference(), searchParams]);
  const s = t.service;

  // Акимат и оператор могут смотреть очередь любой службы (?s=kzhsa)
  const svc = me.role === "service" ? ref.serviceById.get(me.service_id!) : ref.serviceByCode.get(String(sp.s ?? "kzhsa"));
  if (!svc) return <div className="p-6">{s.notFound}</div>;

  // Приоритет растёт со временем в очереди — пересчитываем реальные открытые при открытии очереди
  const real = await listReports({ serviceId: svc.id });
  await Promise.all(real.filter((r) => !["resolved", "rejected"].includes(r.status)).slice(0, 50).map((r) => recomputeReport(r.id)));

  const { all } = await flow();
  const mine = all.filter((r) => r.service === svc.code);
  const open = mine.filter((r) => !["resolved", "rejected"].includes(r.status));
  const now = new Date();
  const hctx = honestContext(all);
  const risk = new Map<number, number>();
  for (const r of open) {
    if (r.sla_breached) continue;
    const f = honestForecast(r, hctx, now);
    if (f.ok && f.pBreach != null) risk.set(r.id, f.pBreach);
  }
  const q = serviceQuality(all).find((x) => x.service === svc.code);
  const counts = new Map(ref.services.map((x) => [x.code, all.filter((r) => r.service === x.code && !["resolved", "rejected"].includes(r.status)).length]));
  const n = new Intl.NumberFormat("ru-RU");

  return (
    <div className="flex w-full flex-col gap-5 px-4 py-6 lg:px-6">
      <LiveRefresh filter={`service_id=eq.${svc.id}`} toastText={s.updated} />
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{s.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{nm(svc, lang)}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{s.sub}</p>
      </div>

      {me.role !== "service" && (
        <nav className="flex gap-1.5 overflow-x-auto pb-1">
          {ref.services.map((x) => (
            <Link
              key={x.code}
              href={`/service?s=${x.code}`}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors", x.id === svc.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
            >
              {x.short_name}
              <span className="tabular-nums opacity-70">{counts.get(x.code) ?? 0}</span>
            </Link>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={s.kpiOpen} value={n.format(open.length)} icon={<Inbox />} />
        <Kpi label={s.kpiBreached} value={n.format(open.filter((r) => r.sla_breached).length)} tone="danger" icon={<AlarmClock />} />
        <Kpi label={s.kpiRisk} value={n.format([...risk.values()].filter((p) => p >= 0.5).length)} tone="warn" icon={<ShieldAlert />} />
        <Kpi label={s.kpiAwaiting} value={n.format(open.filter((r) => r.status === "awaiting_confirmation").length)} icon={<CheckCheck />} />
        <Kpi label={s.kpiReopened} value={n.format(mine.filter((r) => r.reopen_count > 0).length)} icon={<RotateCcw />} />
        <Kpi label={s.kpiMedian} value={q?.medianDays ?? "—"} tone="ok" icon={<Timer />} />
      </div>

      {/* Доска: колонки по этапам, внутри — по приоритету */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
        <div className="grid min-w-[980px] grid-cols-4 gap-3">
          {COLUMNS.map((c) => {
            const list = open.filter((r) => (c.statuses as readonly string[]).includes(r.status)).sort((a, b) => b.priority - a.priority);
            return (
              <section key={c.key} className={cn("flex flex-col rounded-xl border border-t-4 bg-muted/30", c.tone)}>
                <h2 className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold">
                  {s.board[c.key]}
                  <span className="rounded-full bg-background px-2 text-xs tabular-nums">{list.length}</span>
                </h2>
                <ul className="flex flex-col gap-2 px-2 pb-2">
                  {list.slice(0, PER_COLUMN).map((r) => (
                    <li key={r.id}>
                      <Card r={r} risk={risk.get(r.id) ?? null} lang={lang} t={t} />
                    </li>
                  ))}
                  {list.length > PER_COLUMN && <li className="px-1 py-1 text-center text-xs text-muted-foreground">{fmt(s.more, { n: list.length - PER_COLUMN })}</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{s.sortNote}</p>
    </div>
  );
}

function Card({ r, risk, lang, t }: { r: FlowReport; risk: number | null; lang: "ru" | "kz"; t: Awaited<ReturnType<typeof getDict>>["t"] }) {
  const p = Math.round(r.priority);
  const pr = risk != null ? Math.round(risk * 100) : null;
  return (
    <Link
      href={`/report/${r.public_no}`}
      className="group block rounded-lg border bg-card p-3 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_22px_-14px_rgb(5_62_66/0.5)]"
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums",
            p >= 120 ? "bg-[color:var(--danger)]/15 text-[color:var(--danger)]" : p >= 80 ? "bg-[color:var(--warn)]/15 text-[color:var(--warn)]" : "bg-muted text-muted-foreground"
          )}
          title={t.card.priority}
        >
          {p}
        </span>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm leading-snug font-medium group-hover:text-primary">{titleOf(r, lang)}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {nm(CATEGORY[r.category], lang)}
            {r.district && DISTRICT[r.district] ? ` · ${nm(DISTRICT[r.district], lang)}` : ""}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <SlaTimer dueAt={r.sla_due_at} closed={false} t={t.card} compact />
        {pr != null && pr >= 30 && (
          <span className={cn("rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums", pr >= 50 ? "border-[color:var(--danger)]/40 text-[color:var(--danger)]" : "border-[color:var(--warn)]/40 text-[color:var(--warn)]")}>
            {fmt(t.service.risk, { p: pr })}
          </span>
        )}
        {r.reopen_count > 0 && <span className="rounded-md bg-[color:var(--danger)]/10 px-1.5 py-0.5 text-xs text-[color:var(--danger)]">{t.service.reopenedBadge}</span>}
        {r.confirmations > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <Users className="size-3" /> {r.confirmations}
          </span>
        )}
      </div>
    </Link>
  );
}
