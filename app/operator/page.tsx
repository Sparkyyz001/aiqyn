import { requireRole } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { getReference } from "@/lib/reference";
import { listReports } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportRow } from "@/components/reports/report-row";
import { ReportForm } from "@/app/report/new/report-form";
import { IncidentForm } from "./incident-form";
import { ActiveIncidents } from "./active-incidents";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.operator };
}

export default async function OperatorPage() {
  const me = await requireRole("operator", "akimat");
  const [{ lang, t }, ref] = await Promise.all([getDict(), getReference()]);
  const db = createAdminClient();
  const [recent, { data: incidents }] = await Promise.all([
    listReports({ source: ["operator", "call109", "instagram"], limit: 20 }),
    db.from("incidents").select("id, title, type, eta_at, started_at").eq("status", "active").order("started_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="text-sm text-muted-foreground">{t.nav.operator}</div>
      <h1 className="text-xl font-semibold">{t.operator.title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        {t.operator.intro}
      </p>
      <Tabs defaultValue="report" className="mt-4">
        <TabsList>
          <TabsTrigger value="report">{t.operator.tabReport}</TabsTrigger>
          <TabsTrigger value="incident">{t.operator.tabIncident}</TabsTrigger>
          <TabsTrigger value="recent">{t.operator.tabRecent}</TabsTrigger>
        </TabsList>
        <TabsContent value="report" className="-mx-4">
          <ReportForm operator userId={me.id} lang={lang} t={{ report: t.report, common: t.common, card: t.card, status: t.status, operator: t.operator, routing: t.routing, quality: t.quality }} />
        </TabsContent>
        <TabsContent value="incident" className="grid gap-6 pt-4 lg:grid-cols-2">
          <IncidentForm t={t.incident} lang={lang} districts={ref.districts.filter((d) => d.polygon && d.kind !== "zone").map((d) => ({ id: d.id, name: lang === "kz" ? d.name_kz : d.name_ru }))} />
          <ActiveIncidents t={t.incident} incidents={incidents ?? []} />
        </TabsContent>
        <TabsContent value="recent" className="pt-4">
          {recent.length ? (
            <ul className="divide-y rounded-lg border">
              {recent.map((r) => (
                <li key={r.id}>
                  <ReportRow r={r} lang={lang} t={t} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t.operator.empty}</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
