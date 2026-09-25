import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, MapPin, Siren, ShieldCheck, ShieldAlert, Users, RotateCcw, Info, Sparkles, Clock } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference, nearestSocial } from "@/lib/reference";
import { settleVerification } from "@/lib/actions/reports";
import { computePriority, PRIORITY_LABELS } from "@/lib/priority";
import { boilerplateScore, BOILERPLATE_THRESHOLD } from "@/lib/boilerplate";
import { nm } from "@/lib/meta";
import { fmt as tf, type Dict } from "@/lib/i18n/dict";
import { SlaTimer } from "@/components/reports/sla-timer";
import { StatusBadge } from "@/components/status-badge";
import { LiveRefresh } from "@/components/live-refresh";
import { CityMap } from "@/components/map/map";
import { ReportActions } from "./report-actions";
import { DemoCard } from "./demo-card";
import { isDemoNo, legacyDemoNo } from "@/lib/demo-baseline";
import { redirect } from "next/navigation";
import { Outcome } from "@/components/reports/outcome";
import { PainContribution } from "@/components/reports/pain-contribution";
import { HonestDeadline } from "@/components/reports/honest-deadline";
import { ShareButton } from "@/components/reports/share-button";
import { BudgetButton } from "@/components/reports/budget-button";
import { StatusStepper } from "@/components/reports/status-stepper";
import { EventIcon } from "@/components/reports/event-icon";
import { MONEY_REASONS } from "@/lib/delay";
import { honestContext, honestForecast } from "@/lib/honest-deadline";
import { flow } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/report/[no]">) {
  const { no } = await params;
  const { lang } = await getDict();
  // превью в Telegram/WhatsApp — та же карточка-постер, что и для шеринга
  const image = { url: `/api/og/report/${no}?lang=${lang}`, width: 1080, height: 1350 };
  return { title: no, openGraph: { title: `AIQYN · ${no}`, images: [image] }, twitter: { card: "summary_large_image", images: [image.url] } };
}

const fmt = (s: string) =>
  new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Aqtau" });

export default async function ReportPage({ params }: PageProps<"/report/[no]">) {
  const { no } = await params;
  // Демо-записи подложки: отдельная карточка только для чтения
  const legacy = legacyDemoNo(no);
  if (legacy) redirect(`/report/${legacy}`);
  if (isDemoNo(no)) {
    const [{ lang, t }, { all }, me, { data: init }] = await Promise.all([
      getDict(),
      flow(),
      getProfile(),
      createAdminClient().from("initiatives").select("id").eq("report_no", no).maybeSingle(),
    ]);
    const demo = all.find((x) => x.public_no === no);
    if (!demo) notFound();
    const honest = honestForecast(demo, honestContext(all));
    return <DemoCard r={demo} lang={lang} t={t} honest={honest} budget={{ existing: init?.id ?? null, loggedIn: !!me }} />;
  }
  const db = createAdminClient();
  const { data: head } = await db.from("reports").select("id, status").eq("public_no", no).maybeSingle();
  if (!head) notFound();
  // Ленивое подведение итога голосования, если окно 72 ч истекло
  if (head.status === "awaiting_confirmation") await settleVerification(head.id);

  const [{ lang, t }, me, ref, { data: budgetInit }] = await Promise.all([
    getDict(),
    getProfile(),
    getReference(),
    db.from("initiatives").select("id").eq("report_no", no).maybeSingle(),
  ]);
  const [{ data: r }, { data: photos }, { data: events }, { data: replies }, { data: conf }, { data: votes }] = await Promise.all([
    db.from("reports").select("*").eq("id", head.id).single(),
    db.from("report_photos").select("*").eq("report_id", head.id).order("created_at"),
    db.from("report_events").select("*").eq("report_id", head.id).order("created_at"),
    db.from("service_replies").select("*").eq("report_id", head.id).order("created_at"),
    db.from("report_confirmations").select("user_id, weight").eq("report_id", head.id),
    db.from("report_verifications").select("user_id, verdict, round").eq("report_id", head.id),
  ]);
  if (!r) notFound();

  const cat = ref.categoryById.get(r.category_id)!;
  const svc = r.service_id ? ref.serviceById.get(r.service_id) : null;
  const district = r.district_id ? ref.districtById.get(r.district_id) : null;
  const incident = r.incident_id ? (await db.from("incidents").select("title, eta_at, status").eq("id", r.incident_id).single()).data : null;
  let chronic = 0;
  if (r.cluster_id) chronic = (await db.from("clusters").select("chronic_score").eq("id", r.cluster_id).single()).data?.chronic_score ?? 0;

  const closed = r.status === "resolved" || r.status === "rejected";
  // Честный срок: прогноз по похожим обращениям (только для открытых)
  const { all } = await flow();
  const honest = closed
    ? null
    : honestForecast(
        { id: r.id, category: cat.code, service: svc?.code ?? "akimat", district: district?.code ?? null, status: r.status, created_at: r.created_at, resolved_at: r.resolved_at, sla_due_at: r.sla_due_at },
        honestContext(all)
      );
  const social = nearestSocial(r);
  const prio = computePriority({
    severityBase: cat.severity_base,
    confirmationWeights: (conf ?? []).reduce((s, c) => s + Number(c.weight), 0),
    daysInQueue: (Date.now() - new Date(r.created_at).getTime()) / 86400_000,
    slaDays: cat.sla_days,
    nearSocial: !!social,
    slaBreached: !!r.sla_breached_at,
    chronicScore: chronic,
    reopenCount: r.reopen_count,
  });

  const before = (photos ?? []).filter((p) => p.kind === "before");
  const after = (photos ?? []).filter((p) => p.kind === "after");
  const isAuthor = me?.id === r.author_id;
  const isConfirmer = !!me && (conf ?? []).some((c) => c.user_id === me.id);
  const myVote = me ? (votes ?? []).find((v) => v.user_id === me.id && v.round === r.reopen_count) : undefined;
  const isStaff = !!me && (["akimat", "operator"].includes(me.role) || (me.role === "service" && me.service_id === r.service_id));
  const canEscalate = !!r.sla_breached_at || r.reopen_count >= 2;

  // Имена участников хронологии
  const actorIds = [...new Set((events ?? []).map((e) => e.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length ? await db.from("profiles").select("id, role, full_name, service_id").in("id", actorIds) : { data: [] };
  const actorName = (id: string | null) => {
    if (!id) return "AIQYN";
    const a = (actors ?? []).find((x) => x.id === id);
    if (!a) return "—";
    if (a.role === "service") return ref.serviceById.get(a.service_id)?.short_name ?? t.roles.service;
    if (a.role === "citizen") return id === r.author_id ? `${t.roles.citizen} (${t.me.author})` : t.roles.citizen;
    return t.roles[a.role as keyof typeof t.roles];
  };

  // Системные записи хранят код сообщения (meta.msg / meta.rule) — показываем на языке пользователя.
  // Пользовательские комментарии и старые записи без кода — как есть.
  type Ev = { type: string; comment: string | null; meta: Record<string, unknown> | null };
  const eventText = (e: Ev): string | null => {
    const m = e.meta ?? {};
    if (m.msg === "delay_set") return tf(t.events.delay_set, { reasonLabel: t.card.delayReasons[m.reason as keyof Dict["card"]["delayReasons"]] ?? String(m.reason) }) + (e.comment ? ` — ${e.comment}` : "");
    if (typeof m.msg === "string" && m.msg in t.events) return tf(t.events[m.msg as keyof Dict["events"]] as string, m as Record<string, string>);
    if (e.type === "routed" && m.service) {
      const short = ref.serviceByCode.get(String(m.service))?.short_name ?? "";
      const reason = m.rule ? t.routing[m.rule as keyof Dict["routing"]] : t.routing.default;
      return `${short}: ${reason ?? e.comment}`;
    }
    if (e.type === "created" && m.source === "press") return t.events.press;
    return e.comment;
  };
  const photoReasonText = (e: Ev): string | null => {
    const codes = e.meta?.reason_codes as { code: string; d?: number; max?: number }[] | undefined;
    if (codes?.length) return codes.map((x) => tf(t.photoReasons[x.code as keyof Dict["photoReasons"]] ?? x.code, { d: x.d ?? "", max: x.max ?? "" })).join("; ");
    const old = e.meta?.reasons as string[] | undefined;
    return old?.length ? old.join("; ") : null;
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <LiveRefresh filter={`id=eq.${r.id}`} toastText={t.card.statusChanged} />
      <LiveRefresh table="report_events" filter={`report_id=eq.${r.id}`} />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="font-mono">{r.public_no}</span>
        <span>·</span>
        <span>{nm(cat, lang)}</span>
        {district && (
          <>
            <span>·</span>
            <span>{nm(district, lang)}</span>
          </>
        )}
        <span>·</span>
        <span>{fmt(r.created_at)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{r.title}</h1>
        <StatusBadge status={r.status} label={t.status[r.status as keyof typeof t.status]} className="text-sm" />
      </div>

      {incident && incident.status === "active" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#b4447a]/40 bg-[#b4447a]/5 p-3 text-sm">
          <Siren className="mt-0.5 size-4 text-[#b4447a]" />
          <div>
            <span className="font-medium">{t.card.incident}:</span> {incident.title}
            {incident.eta_at && ` · ${t.card.restoreBy} ${fmt(incident.eta_at)}`}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl border bg-card px-2 py-4 sm:px-4">
        <StatusStepper status={r.status} reopenCount={r.reopen_count} dates={[r.created_at, r.created_at, r.accepted_at, null, r.resolved_at]} l={t.card.steps} />
      </div>

      {honest && r.status !== "awaiting_confirmation" && (
        <div className="mt-4">
          <HonestDeadline f={honest} dueAt={r.sla_due_at} t={t.honest} lang={lang} />
        </div>
      )}

      {!closed && r.delay_reason && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[color:var(--warn)]/45 bg-[color:var(--warn)]/[0.07] p-3 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-[color:var(--warn)]" />
          <div className="min-w-0">
            <div className="font-medium">
              {t.card.delayTitle}: {t.card.delayReasons[r.delay_reason as keyof Dict["card"]["delayReasons"]] ?? r.delay_reason}
              {r.delay_at && <span className="font-normal text-muted-foreground"> · {tf(t.card.delaySince, { d: fmt(r.delay_at) })}</span>}
            </div>
            {r.delay_note && <p className="mt-0.5 text-muted-foreground text-pretty">{r.delay_note}</p>}
            {MONEY_REASONS.includes(r.delay_reason) && (
              <Link href="/budget" className="mt-1 inline-block text-xs text-primary hover:underline">
                {t.card.delayBudget} →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <ShareButton no={no} lang={lang} t={t.share} extra={!closed ? <BudgetButton no={no} existing={budgetInit?.id ?? null} loggedIn={!!me} t={t.initiatives} /> : null} />
      </div>

      {/* Телефон: главное — сколько осталось по закону и сколько людей видят проблему — сразу под заголовком */}
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-stretch gap-2 lg:hidden">
        <SlaTimer dueAt={r.sla_due_at} closed={closed} t={t.card} />
        <div className="flex flex-col justify-center rounded-lg border px-3 text-center">
          <div className="text-lg font-semibold tabular-nums">{r.confirmations_count}</div>
          <div className="text-[11px] leading-tight text-muted-foreground">{t.card.confirmations}</div>
        </div>
        <div className="flex flex-col justify-center rounded-lg border px-3 text-center">
          <div className={`text-lg font-semibold tabular-nums ${r.reopen_count ? "text-[color:var(--danger)]" : ""}`}>{r.reopen_count}</div>
          <div className="text-[11px] leading-tight text-muted-foreground">{t.card.reopened}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {r.description && <p className="whitespace-pre-wrap text-pretty">{r.description}</p>}

          <Outcome
            status={r.status}
            createdAt={r.created_at}
            resolvedAt={r.resolved_at}
            slaDueAt={r.sla_due_at}
            resolution={(replies ?? []).length ? (replies ?? [])[(replies ?? []).length - 1].text : null}
            serviceName={svc ? nm(svc, lang) : null}
            t={t.outcome}
          />

          {(before.length > 0 || after.length > 0) && (
            <section>
              <h2 className="mb-2 font-medium">{t.card.photos}</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t.card.before, list: before },
                  { label: t.card.after, list: after },
                ].map((col) => (
                  <div key={col.label} className="flex flex-col gap-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase">{col.label}</div>
                    {col.list.length ? (
                      col.list.map((p) => (
                        <figure key={p.id} className="overflow-hidden rounded-lg border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={col.label} className="aspect-[4/3] w-full object-cover" />
                          <figcaption className={`flex items-center gap-1 px-2 py-1 text-xs ${p.geo_verified ? "text-[color:var(--ok)]" : "text-[color:var(--warn)]"}`}>
                            {p.geo_verified ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
                            {p.geo_verified ? t.card.geoOk : t.card.geoBad}
                            {p.taken_at && <span className="ml-auto text-muted-foreground">{fmt(p.taken_at)}</span>}
                          </figcaption>
                          {p.ai_check && (
                            <div
                              className={`flex items-start gap-1.5 border-t px-2 py-1.5 text-xs ${p.ai_check.verdict === "fixed" ? "bg-[color:var(--ok)]/[0.07] text-[color:var(--ok)]" : "bg-[color:var(--warn)]/[0.08] text-[color:var(--warn)]"}`}
                              title={lang === "kz" ? p.ai_check.explanation_kz : p.ai_check.explanation_ru}
                            >
                              <Sparkles className="mt-px size-3.5 shrink-0" />
                              <span>
                                <span className="font-medium">
                                  {({ fixed: t.card.aiFixed, not_fixed: t.card.aiNotFixed, different_place: t.card.aiOther } as Record<string, string>)[p.ai_check.verdict] ?? t.card.aiUnclear}
                                  {` · ${Math.round(p.ai_check.confidence * 100)}%`}
                                </span>
                                <span className="block text-muted-foreground">{lang === "kz" ? p.ai_check.explanation_kz : p.ai_check.explanation_ru}</span>
                              </span>
                            </div>
                          )}
                        </figure>
                      ))
                    ) : (
                      <div className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed text-xs text-muted-foreground">—</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <ReportActions
            report={{ id: r.id, status: r.status, public_no: r.public_no, verification_due_at: r.verification_due_at, delay_reason: r.delay_reason ?? null }}
            viewer={me ? { id: me.id, role: me.role } : null}
            isAuthor={isAuthor}
            isConfirmer={isConfirmer}
            myVote={myVote?.verdict ?? null}
            isStaff={isStaff}
            canEscalate={canEscalate}
            t={{ card: t.card, common: t.common, nav: t.nav, actions: t.actions, photoReasons: t.photoReasons }}
          />

          {(replies ?? []).length > 0 && (
            <section>
              <h2 className="mb-2 font-medium">{t.card.replies}</h2>
              <ul className="flex flex-col gap-2">
                {(replies ?? []).map((rep) => {
                  const b = boilerplateScore(rep.text);
                  return (
                    <li key={rep.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{ref.serviceById.get(rep.service_id)?.short_name} · {fmt(rep.created_at)}</span>
                        {(rep.boilerplate_score ?? 0) >= BOILERPLATE_THRESHOLD && (
                          <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[color:var(--warn)]" title={`${t.card.markers}: ${b.markers.join(", ") || "—"}; ${t.card.lacks}: ${b.missing.map((m) => t.akimat.quality.missing[m]).join(", ")}`}>
                            {t.card.noSpecifics} · {Math.round((rep.boilerplate_score ?? 0) * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{rep.text}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 font-medium">{t.card.timeline}</h2>
            <ol className="relative ml-3.5 border-l pl-6">
              {(events ?? []).map((e) => (
                <li key={e.id} className="relative mb-5 last:mb-0">
                  <EventIcon type={e.type} to={e.to_status} />
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {fmt(e.created_at)} · {actorName(e.actor_id)}
                  </div>
                  <div className="text-sm">
                    {e.to_status ? (
                      <>
                        {e.from_status && <span className="text-muted-foreground">{t.status[e.from_status as keyof typeof t.status]} → </span>}
                        <span className="font-medium">{t.status[e.to_status as keyof typeof t.status]}</span>
                      </>
                    ) : (
                      <span className="font-medium">
                        {({ confirmed: t.events.confirmed, reply: t.events.reply, verification: e.meta?.verdict === "fixed" ? t.card.voteYes : t.card.voteNo, escalated: t.events.escalated, incident_linked: t.events.incident_linked, ai_analysis: t.events.aiPhoto, ai_after_check: t.events.aiCheck, delay_reason: t.events.delayReason } as Record<string, string>)[e.type] ?? e.type}
                      </span>
                    )}
                  </div>
                  {e.type !== "reply" && eventText(e) && <div className="text-sm text-muted-foreground">{eventText(e)}</div>}
                  {photoReasonText(e) && <div className="text-xs text-[color:var(--warn)]">{photoReasonText(e)}</div>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="hidden lg:block">
            <SlaTimer dueAt={r.sla_due_at} closed={closed} t={t.card} />
          </div>

          <div className="hidden grid-cols-2 gap-3 lg:grid">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums"><Users className="size-5 text-muted-foreground" />{r.confirmations_count}</div>
              <div className="text-xs text-muted-foreground">{t.card.confirmations}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className={`flex items-center gap-1.5 text-2xl font-semibold tabular-nums ${r.reopen_count ? "text-[color:var(--danger)]" : ""}`}><RotateCcw className="size-5 text-muted-foreground" />{r.reopen_count}</div>
              <div className="text-xs text-muted-foreground">{t.card.reopened}, {t.card.times}</div>
            </div>
          </div>

          <PainContribution reportId={r.id} district={district?.code ?? null} t={t.pain} />

          {svc && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="text-xs text-muted-foreground">{t.card.service}</div>
              <div className="font-medium">{nm(svc, lang)}</div>
              {svc.address && <div className="text-xs text-muted-foreground">{svc.address}</div>}
              {svc.contact_phone && <div className="text-xs">{t.card.phone} {svc.contact_phone}</div>}
              {!svc.verified && <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Info className="size-3" />{t.card.unverifiedOrg}</div>}
            </div>
          )}

          <details className="rounded-lg border p-3 text-sm">
            <summary className="flex cursor-pointer items-center justify-between">
              <span>{t.card.priority}</span>
              <span className="font-semibold tabular-nums">{prio.score}</span>
            </summary>
            <div className="mt-2 text-xs text-muted-foreground">{t.card.whyPriority}</div>
            <ul className="mt-1 space-y-1">
              {prio.terms.map((term) => (
                <li key={term.key} className={`flex justify-between gap-2 ${term.value ? "" : "text-muted-foreground"}`}>
                  <span>{PRIORITY_LABELS[term.key][lang]}</span>
                  <span className="tabular-nums">+{term.value}</span>
                </li>
              ))}
            </ul>
          </details>

          <div className="overflow-hidden rounded-lg border">
            <CityMap className="h-52 w-full" center={{ lat: r.lat, lng: r.lng }} zoom={16} picked={{ lat: r.lat, lng: r.lng }} />
            <div className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground">
              <MapPin className="size-3" /> {r.address_text ?? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`}
            </div>
          </div>

          {r.source_url && (
            <Link href={r.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
              <ExternalLink className="size-3.5" /> {t.card.source} ({t.card.sources[r.source as keyof Dict["card"]["sources"]] ?? r.source})
            </Link>
          )}
          <p className="text-xs text-muted-foreground">{t.card.live}</p>
        </aside>
      </div>
    </div>
  );
}
