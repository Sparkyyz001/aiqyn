import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { getReference } from "@/lib/reference";
import { listReports } from "@/lib/queries";
import { recomputeReport } from "@/lib/report-engine";
import { nm } from "@/lib/meta";
import { ReportRow } from "@/components/reports/report-row";
import { LiveRefresh } from "@/components/live-refresh";
import { Kpi } from "@/components/kpi";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.service.title };
}

const TABS = [
  { key: "new", statuses: ["new", "routed", "reopened"] },
  { key: "work", statuses: ["accepted", "in_progress"] },
  { key: "await", statuses: ["awaiting_confirmation"] },
  { key: "done", statuses: ["resolved", "rejected"] },
] as const;

export default async function ServicePage({ searchParams }: PageProps<"/service">) {
  const me = await requireRole("service", "akimat", "operator");
  const [{ lang, t }, ref, sp] = await Promise.all([getDict(), getReference(), searchParams]);

  // Акимат и оператор могут смотреть очередь любой службы (?s=kzhsa)
  const svc = me.role === "service" ? ref.serviceById.get(me.service_id!) : ref.serviceByCode.get(String(sp.s ?? "kzhsa"));
  if (!svc) return <div className="p-6">{t.service.notFound}</div>;
  const tab = TABS.find((x) => x.key === sp.tab) ?? TABS[0];

  const all = await listReports({ serviceId: svc.id });
  // Приоритет растёт со временем в очереди — пересчитываем открытые при открытии очереди
  const open = all.filter((r) => !["resolved", "rejected"].includes(r.status));
  await Promise.all(open.slice(0, 50).map((r) => recomputeReport(r.id)));
  const fresh = open.length ? await listReports({ serviceId: svc.id }) : all;

  const list = fresh.filter((r) => (tab.statuses as readonly string[]).includes(r.status));
  const breached = fresh.filter((r) => !["resolved", "rejected"].includes(r.status) && r.sla_due_at && new Date(r.sla_due_at) < new Date()).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <LiveRefresh filter={`service_id=eq.${svc.id}`} toastText={t.service.updated} />
      <div className="text-sm text-muted-foreground">{t.nav.service}</div>
      <h1 className="text-xl font-semibold">{nm(svc, lang)}</h1>
      {me.role !== "service" && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ref.services.map((s) => (
            <Link key={s.code} href={`/service?s=${s.code}`} className={`rounded-md border px-2 py-0.5 text-xs ${s.id === svc.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
              {s.short_name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t.service.kpiOpen} value={open.length} />
        <Kpi label={t.service.kpiBreached} value={breached} tone={breached ? "danger" : undefined} />
        <Kpi label={t.service.kpiAwaiting} value={fresh.filter((r) => r.status === "awaiting_confirmation").length} tone="warn" />
        <Kpi label={t.service.kpiReopened} value={fresh.filter((r) => r.reopen_count > 0).length} />
      </div>

      <nav className="mt-5 flex flex-wrap gap-x-1 border-b">
        {TABS.map((x) => {
          const n = fresh.filter((r) => (x.statuses as readonly string[]).includes(r.status)).length;
          return (
            <Link
              key={x.key}
              href={`/service?tab=${x.key}${me.role !== "service" ? `&s=${svc.code}` : ""}`}
              className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${x.key === tab.key ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}
            >
              {t.service.tabs[x.key]} <span className="tabular-nums">{n}</span>
            </Link>
          );
        })}
      </nav>
      <p className="mt-2 text-xs text-muted-foreground">{t.service.sortNote}</p>
      {list.length ? (
        <ul className="mt-2 divide-y rounded-lg border">
          {list.map((r) => (
            <li key={r.id}>
              <ReportRow r={r} lang={lang} t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-center text-sm text-muted-foreground">{t.service.empty}</p>
      )}
    </div>
  );
}
