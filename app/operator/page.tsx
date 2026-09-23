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

export const metadata = { title: "Оператор 109" };

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
      <h1 className="text-xl font-semibold">Заведение обращений и аварий</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Оператор 109 заводит звонки и публичные посты городских аккаунтов (@112aktau, @hype_aktau) — по ссылке на оригинал,
        без скрейпинга. В продакшне Instagram подключается штатно через Graph API (webhook на mentions/comments) для аккаунтов,
        чьи владельцы подключили платформу как партнёра.
      </p>
      <Tabs defaultValue="report" className="mt-4">
        <TabsList>
          <TabsTrigger value="report">Обращение</TabsTrigger>
          <TabsTrigger value="incident">Авария</TabsTrigger>
          <TabsTrigger value="recent">Заведённые</TabsTrigger>
        </TabsList>
        <TabsContent value="report" className="-mx-4">
          <ReportForm operator userId={me.id} lang={lang} t={{ report: t.report, common: t.common, card: t.card, status: t.status }} />
        </TabsContent>
        <TabsContent value="incident" className="grid gap-6 pt-4 lg:grid-cols-2">
          <IncidentForm districts={ref.districts.filter((d) => d.polygon && d.kind !== "zone").map((d) => ({ id: d.id, name: lang === "kz" ? d.name_kz : d.name_ru }))} />
          <ActiveIncidents incidents={incidents ?? []} />
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
            <p className="text-sm text-muted-foreground">Пока пусто</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
