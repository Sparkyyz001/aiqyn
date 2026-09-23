import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { getReference } from "@/lib/reference";
import { listReports } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { ReportRow } from "@/components/reports/report-row";
import { LiveRefresh } from "@/components/live-refresh";
import { DistrictPicker } from "./district-picker";

export const metadata = { title: "Мои обращения" };

export default async function MePage() {
  const me = await requireRole();
  const [{ lang, t }, ref] = await Promise.all([getDict(), getReference()]);
  const db = createAdminClient();
  const { data: conf } = await db.from("report_confirmations").select("report_id").eq("user_id", me.id);

  const [mine, confirmed, yard] = await Promise.all([
    listReports({ authorId: me.id }),
    listReports({ ids: (conf ?? []).map((c) => c.report_id) }),
    me.district_id
      ? listReports({ districtId: me.district_id, statuses: ["new", "routed", "accepted", "in_progress", "awaiting_confirmation", "reopened"], limit: 30 })
      : Promise.resolve([]),
  ]);
  const needVote = [...mine, ...confirmed].filter((r) => r.status === "awaiting_confirmation");

  const section = (title: string, list: typeof mine, empty?: React.ReactNode) => (
    <section className="mt-6">
      <h2 className="mb-2 font-medium">
        {title} <span className="text-muted-foreground tabular-nums">{list.length}</span>
      </h2>
      {list.length ? (
        <ul className="divide-y rounded-lg border">
          {list.map((r) => (
            <li key={r.id}>
              <ReportRow r={r} lang={lang} t={t} showPriority={false} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{empty ?? "—"}</div>
      )}
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      {/* Уведомление автору мгновенно, когда служба меняет статус (Realtime) */}
      <LiveRefresh filter={`author_id=eq.${me.id}`} toastText={t.card.statusChanged} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{t.roles[me.role]}</div>
          <h1 className="text-xl font-semibold">{me.full_name ?? t.nav.me}</h1>
        </div>
        <Button asChild>
          <Link href="/report/new">
            <Plus /> {t.nav.report}
          </Link>
        </Button>
      </div>

      {needVote.length > 0 && (
        <div className="mt-5 rounded-lg border-2 border-[color:var(--warn)] bg-warn/5 p-4">
          <div className="font-medium">{t.card.voteTitle}</div>
          <ul className="mt-2 divide-y rounded-md border bg-card">
            {needVote.map((r) => (
              <li key={r.id}>
                <ReportRow r={r} lang={lang} t={t} showPriority={false} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {section(t.nav.me, mine, <Link href="/report/new" className="text-primary hover:underline">{t.nav.report} →</Link>)}
      {section(`${t.card.iSeeToo}`, confirmed)}

      <section className="mt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Мой двор</h2>
          <DistrictPicker
            value={me.district_id}
            options={ref.districts.filter((d) => d.kind !== "zone").map((d) => ({ id: d.id, name: lang === "kz" ? d.name_kz : d.name_ru }))}
          />
        </div>
        {me.district_id ? (
          yard.length ? (
            <ul className="divide-y rounded-lg border">
              {yard.map((r) => (
                <li key={r.id}>
                  <ReportRow r={r} lang={lang} t={t} showPriority={false} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Открытых обращений в районе нет</div>
          )
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Выберите свой микрорайон, чтобы следить за ним</div>
        )}
        {me.district_id && <LiveRefresh filter={`district_id=eq.${me.district_id}`} />}
      </section>
    </div>
  );
}
