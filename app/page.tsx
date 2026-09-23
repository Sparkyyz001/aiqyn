import Link from "next/link";
import { ArrowRight, ArrowUpRight, Camera, ExternalLink, Landmark, LogIn, Plus, Scale, ShieldCheck, UserRound, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CityMap } from "@/components/map/map";
import { LiveRefresh } from "@/components/live-refresh";
import { StatusBadge } from "@/components/status-badge";
import { LandscapeHero } from "@/components/landing/landscape-hero";
import { ScrollWords } from "@/components/landing/scroll-words";
import { Accent } from "@/components/landing/accent";
import { SpotlightTracker } from "@/components/landing/spotlight";
import { HonestDeadline } from "@/components/reports/honest-deadline";
import { honestContext, honestForecast, honestMetrics } from "@/lib/honest-deadline";
import { fmt as tf } from "@/lib/i18n/dict";
import { CountUp, Reveal } from "@/components/landing/motion";
import { getDict } from "@/lib/i18n/server";
import { flow, toMapPoint } from "@/lib/data";
import { kpis } from "@/lib/stats";
import { CATEGORY, DISTRICT, nm } from "@/lib/meta";

const STEP_ICONS = [Camera, Scale, ShieldCheck, Users];
const ROLE_ICONS = [UserRound, Wrench, Landmark];
// Каждой роли — свой фрагмент пейзажа первого экрана
const ROLE_ART = ["8% 88%", "48% 30%", "96% 62%"];

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.18em] text-lt-green uppercase">
      <span className="kicker-line h-px w-8 bg-lt-green" aria-hidden />
      {children}
    </p>
  );
}

export default async function Home() {
  const [{ lang, t }, { all, real }] = await Promise.all([getDict(), flow()]);
  const k = kpis(all);
  const h = t.home;
  const recent = real.slice(0, 5);
  // Живой пример «Честного срока»: открытое обращение с самым большим расхождением прогноза и закона
  const hctx = honestContext(all);
  const now = new Date();
  const example = all
    .filter((r) => ["routed", "accepted", "in_progress"].includes(r.status) && r.sla_due_at && new Date(r.sla_due_at) > now)
    .map((r) => ({ r, f: honestForecast(r, hctx, now) }))
    .filter((v) => v.f.ok)
    .sort((a, b) => (b.f.ok && a.f.ok ? (b.f.lateBy ?? 0) - (a.f.lateBy ?? 0) : 0))[0];
  const hRows = new Intl.NumberFormat("ru-RU").format(honestMetrics.train_rows + honestMetrics.test_rows);
  const hPct = Math.round(honestMetrics.improvement_vs_official_pct);

  return (
    <>
      <LiveRefresh />
      <SpotlightTracker />
      <div className="scroll-progress" aria-hidden />

      {/* 1. Первый экран — иллюстрированный пейзаж, главная фраза и кнопки */}
      <LandscapeHero
        f={{
          eyebrow: h.final.eyebrow,
          lines: h.h1,
          sub: h.sub,
          cta: h.ctaReport,
          ctaMap: h.ctaMap,
        }}
      />

      {/* Дальше весь лендинг — в палитре переднего плана пейзажа */}
      <div className="dark theme-lagoon bg-background text-foreground">
        {/* 2. Манифест: слова загораются по мере прокрутки */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-20 pb-16 md:pt-32 md:pb-24">
          <Reveal>
            <Kicker>{h.statementKicker}</Kicker>
          </Reveal>
          <ScrollWords text={h.statement} className="mt-8 max-w-5xl text-3xl leading-[1.15] font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl" />
        </section>

        {/* 2б. Главная фишка — «Честный срок»: два срока вместо одного */}
        <section className="border-t">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:py-28 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <Reveal>
              <Kicker>{h.honestKicker}</Kicker>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance md:text-5xl">
                <Accent text={h.honestTitle} />
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground text-pretty">{h.honestSub}</p>
              <ul className="mt-8 flex flex-col gap-5">
                {h.honestPoints.map(([title, text], i) => (
                  <li key={i} className="flex gap-4">
                    <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-lt-coral/15 text-xs font-semibold text-lt-coral tabular-nums">{i + 1}</span>
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="mt-1 block text-sm text-muted-foreground text-pretty">{tf(text, { rows: hRows, pct: hPct })}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
            {example && (
              <Reveal delay={150}>
                <div className="spot rounded-[28px] border bg-foreground/[0.03] p-4 md:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-lt-green uppercase">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-lt-green opacity-60 motion-reduce:animate-none" />
                        <span className="relative inline-flex size-2 rounded-full bg-lt-green" />
                      </span>
                      {h.honestExample}
                    </span>
                    <Link href={`/report/${example.r.public_no}`} className="inline-flex items-center gap-1 text-sm text-lt-coral hover:underline">
                      {h.honestOpen} <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                  <div className="mb-4">
                    <div className="line-clamp-2 text-lg font-semibold">{lang === "kz" && example.r.title_kz ? example.r.title_kz : example.r.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {nm(CATEGORY[example.r.category], lang)}
                      {example.r.district && DISTRICT[example.r.district] ? ` · ${nm(DISTRICT[example.r.district], lang)}` : ""}
                    </div>
                  </div>
                  <HonestDeadline f={example.f} dueAt={example.r.sla_due_at} t={t.honest} lang={lang} />
                </div>
              </Reveal>
            )}
          </div>
        </section>

        {/* 3. Живые цифры */}
        <section className="border-y bg-foreground/[0.03]">
          <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
            <Reveal>
              <Kicker>{h.statsKicker}</Kicker>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
                <Accent text={h.statsTitle} />
              </h2>
              <p className="mt-3 text-muted-foreground">{h.statsSub}</p>
            </Reveal>
            <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
              {[
                { v: k.total, l: h.sTotal },
                { v: k.resolved, l: h.sResolved, tone: "text-lt-green" },
                { v: k.breachedOpen, l: h.sBreached, tone: "text-lt-coral" },
                { v: k.medianDays, l: h.sMedian, d: 1 },
              ].map((s, i) => (
                <Reveal key={i} delay={i * 90}>
                  <div className={`font-serif text-5xl leading-none tracking-tight md:text-7xl ${s.tone ?? ""}`}>
                    <CountUp value={s.v} decimals={s.d ?? 0} delay={250 + i * 180} />
                  </div>
                  <div className="mt-3 max-w-[16rem] text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{s.l}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Почему это нужно — реальные истории Актау */}
        <section className="mx-auto w-full max-w-7xl px-4 py-20 md:py-28">
          <Reveal>
            <Kicker>{h.whyKicker}</Kicker>
            <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">
              <Accent text={h.whyTitle} />
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">{h.whySub}</p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {h.why.map(([big, text, src, url], i) => (
              <Reveal key={i} delay={i * 110} className="h-full">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="spot group flex h-full flex-col rounded-3xl border bg-foreground/[0.03] p-7 transition-[transform,border-color,background-color] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1.5 hover:border-lt-coral/40 hover:bg-foreground/[0.06]"
                >
                  <div className="font-serif text-4xl leading-tight text-lt-coral">{big}</div>
                  <p className="mt-4 flex-1 text-pretty">{text}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                    {src} <ExternalLink className="size-3" />
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 5. Как это работает — одна большая карточка с шагами */}
        <section id="how" className="mx-auto w-full max-w-7xl scroll-mt-16 px-4 pb-20 md:pb-28">
          <Reveal>
            <div className="rounded-[28px] border bg-foreground/[0.03] p-6 md:p-12">
              <Kicker>{h.howKicker}</Kicker>
              <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">
                <Accent text={h.howTitle} />
              </h2>
              <ol className="relative mt-10 grid overflow-hidden rounded-2xl border md:grid-cols-4">
                <span className="step-line absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-lt-green via-lt-cream to-lt-coral" aria-hidden />
                {h.how.map(([title, text], i) => {
                  const Icon = STEP_ICONS[i];
                  return (
                    <li key={i} className="spot border-b p-6 transition-colors duration-300 last:border-b-0 hover:bg-foreground/[0.04] md:border-r md:border-b-0 md:last:border-r-0">
                      <div className="flex items-start justify-between">
                        <span className="step-icon grid size-11 place-items-center rounded-xl bg-lt-cream text-lt-teal" style={{ "--i": i } as React.CSSProperties}>
                          <Icon className="size-5" />
                        </span>
                        <span className="text-3xl font-semibold text-foreground/15 tabular-nums">0{i + 1}</span>
                      </div>
                      <div className="mt-6 text-lg font-semibold">{title}</div>
                      <p className="mt-2 text-sm text-muted-foreground text-pretty">{text}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Reveal>
        </section>

        {/* 6. Для кого — карточки с фрагментами пейзажа */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-20 md:pb-28">
          <Reveal>
            <Kicker>{h.rolesKicker}</Kicker>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
              <Accent text={h.rolesTitle} />
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {h.roles.map(([title, text, href], i) => {
              const Icon = ROLE_ICONS[i];
              return (
                <Reveal key={i} delay={i * 110} className="h-full">
                  <Link href={href} className="spot group relative isolate flex h-full min-h-[380px] flex-col justify-end overflow-hidden rounded-3xl border p-7">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <div className="absolute inset-0 -z-10 overflow-hidden">
                      <img
                        src="/hero/landscape.webp"
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] [filter:hue-rotate(318deg)_saturate(0.72)_brightness(1.1)_contrast(0.9)] scale-[1.6] group-hover:scale-[1.68]"
                        style={{ objectPosition: ROLE_ART[i], transformOrigin: ROLE_ART[i] }}
                      />
                    </div>
                    <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#053e42] via-[#053e42]/80 to-[#053e42]/10" />
                    <span className="absolute top-5 right-5 grid size-10 place-items-center rounded-full bg-lt-cream/90 text-lt-teal transition-transform duration-500 group-hover:rotate-45">
                      <ArrowUpRight className="size-4" />
                    </span>
                    <span className="grid size-11 place-items-center rounded-xl bg-lt-cream/10 text-lt-cream backdrop-blur">
                      <Icon className="size-5" />
                    </span>
                    <div className="mt-5 text-2xl font-semibold tracking-tight">{title}</div>
                    <p className="mt-2 text-sm text-foreground/75 text-pretty">{text}</p>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* 7. Живая карта и новые обращения */}
        <section className="border-t bg-foreground/[0.03]">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-20 md:py-24 lg:grid-cols-[1fr_380px]">
            <Reveal>
              <div className="overflow-hidden rounded-3xl border bg-card">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <h2 className="font-semibold">{h.liveTitle}</h2>
                  <Link href="/map" className="inline-flex items-center gap-1 text-sm text-lt-coral hover:underline">
                    {t.nav.map} <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                <CityMap
                  points={all.filter((r) => r.status !== "resolved" && r.status !== "rejected").map((r) => toMapPoint(r, lang))}
                  className="h-[380px] w-full md:h-[480px]"
                  statusLabels={t.status}
                  lang={lang}
                  popupLabels={{ created: t.outcome.created, resolved: t.status.resolved, confirmations: t.outcome.confirmations, more: t.outcome.openCard }}
                  demoLabel={t.map.demo}
                  openLabel={t.map.open}
                />
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="h-full rounded-3xl border bg-card">
                <h2 className="border-b px-5 py-4 font-semibold">{t.landing.recent}</h2>
                <ul className="divide-y">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <Link href={`/report/${r.public_no}`} className="block px-5 py-3.5 transition-colors duration-200 hover:bg-accent/60">
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 text-sm font-medium">{r.title}</span>
                          <StatusBadge status={r.status} label={t.status[r.status as keyof typeof t.status]} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {nm(CATEGORY[r.category], lang)}
                          {r.district ? ` · ${nm(DISTRICT[r.district], lang)}` : ""}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 8. Призыв */}
        <section className="mx-auto w-full max-w-7xl px-4 py-24 md:py-32">
          <Reveal>
            <h2 className="max-w-4xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance md:text-6xl">
              <Accent text={h.final.lines.join(" ")} />
            </h2>
            <p className="mt-5 max-w-xl text-muted-foreground text-pretty">{h.ctaSub}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="btn-shine h-12 rounded-full px-6 font-semibold transition-transform duration-300 hover:-translate-y-0.5">
                <Link href="/report/new">
                  <Plus /> {h.ctaReport}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full bg-transparent px-6">
                <Link href="/login">
                  <LogIn /> {h.ctaLogin}
                </Link>
              </Button>
            </div>
          </Reveal>
        </section>
      </div>
    </>
  );
}
