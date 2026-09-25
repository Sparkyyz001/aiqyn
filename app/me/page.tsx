import Link from "next/link";
import { PushToggle } from "@/components/notifications/push-toggle";
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
import { Contribution, type RepEvent } from "@/components/me/contribution";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.me };
}

export default async function MePage() {
  const me = await requireRole();
  const [{ lang, t }, ref] = await Promise.all([getDict(), getReference()]);
  const db = createAdminClient();
  const [{ data: conf }, { data: repEvents }, { data: meRow }] = await Promise.all([
    db.from("report_confirmations").select("report_id").eq("user_id", me.id),
    db.from("reputation_events").select("id, delta, reason, created_at, meta").eq("user_id", me.id).order("created_at", { ascending: false }).limit(8),
    db.from("profiles").select("created_at").eq("id", me.id).single(),
  ]);

  const [mine, confirmed, yard] = await Promise.all([
    listReports({ authorId: me.id }),
    listReports({ ids: (conf ?? []).map((c) => c.report_id) }),
    me.district_id
      ? listReports({ districtId: me.district_id, statuses: ["new", "routed", "accepted", "in_progress", "awaiting_confirmation", "reopened"], limit: 30, withSynthetic: true })
      : Promise.resolve([]),
  ]);
  const needVote = [...mine, ...confirmed].filter((r) => r.status === "awaiting_confirmation");
  const stats = [
    { n: mine.length, l: t.me.statTotal },
    { n: mine.filter((r) => !["resolved", "rejected"].includes(r.status)).length, l: t.me.statOpen },
    { n: mine.filter((r) => r.status === "resolved").length, l: t.me.statDone },
  ];
  const initials = (me.full_name ?? t.roles[me.role]).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const section = (title: string, list: typeof mine, empty?: React.ReactNode) => (
    <section className="mt-6">
      <h2 className="mb-2 font-medium">
        {title} <span className="text-muted-foreground tabular-nums">{list.length}</span>
      </h2>
      {list.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {list.map((r) => (
            <li key={r.id}>
              <ReportRow r={r} lang={lang} t={t} showPriority={false} progress />
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
      <div className="mb-4">
        <PushToggle l={t.notify.push} variant="banner" />
      </div>
      {/* Приветствие и мои цифры */}
      <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#053e42,#075458_55%,#0b6b63)] p-5 text-[#f6f1dd] shadow-[0_24px_50px_-30px_rgb(5_62_66/0.8)] md:p-7">
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-[#76cf6a]/15 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#ff907d] text-lg font-bold text-[#053e42]">{initials}</span>
            <div>
              <div className="text-sm text-[#f6f1dd]/70">{t.me.hello}</div>
              <h1 className="text-2xl font-semibold tracking-tight">{me.full_name ?? t.nav.me}</h1>
            </div>
          </div>
          <Button asChild className="h-11 rounded-full bg-[#ff907d] px-5 font-semibold text-[#053e42] hover:bg-[#ffa592]">
            <Link href="/report/new">
              <Plus /> {t.nav.report}
            </Link>
          </Button>
        </div>
        <div className="relative mt-6 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.l} className="rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10">
              <div className="font-serif text-3xl leading-none tabular-nums">{s.n}</div>
              <div className="mt-1 text-xs text-[#f6f1dd]/70">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {me.role === "citizen" && (
        <Contribution
          rep={Number(me.reputation ?? 1)}
          createdAt={meRow?.created_at ?? null}
          events={(repEvents ?? []) as RepEvent[]}
          impact={[mine.length, mine.filter((r) => r.status === "resolved").length, mine.reduce((n, r) => n + r.confirmations_count, 0)]}
          t={t.me.rep}
        />
      )}

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
          <h2 className="font-medium">{t.me.yard}</h2>
          <DistrictPicker
            placeholder={t.me.districtPh}
            value={me.district_id}
            options={ref.districts.filter((d) => d.kind !== "zone").map((d) => ({ id: d.id, name: lang === "kz" ? d.name_kz : d.name_ru }))}
          />
        </div>
        {me.district_id ? (
          yard.length ? (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {yard.map((r) => (
                <li key={r.id}>
                  <ReportRow r={r} lang={lang} t={t} showPriority={false} progress />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t.me.yardEmpty}</div>
          )
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t.me.yardPick}</div>
        )}
        {me.district_id && <LiveRefresh filter={`district_id=eq.${me.district_id}`} />}
      </section>
    </div>
  );
}
