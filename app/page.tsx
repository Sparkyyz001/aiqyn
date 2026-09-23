import Link from "next/link";
import { ArrowRight, Building2, Camera, ChevronDown, ExternalLink, Landmark, Plus, Scale, ShieldCheck, UserRound, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CityMap } from "@/components/map/map";
import { LiveRefresh } from "@/components/live-refresh";
import { StatusBadge } from "@/components/status-badge";
import { HeroMap } from "@/components/landing/hero-map";
import { HeroVideo } from "@/components/landing/hero-video";
import { CountUp, Reveal } from "@/components/landing/motion";
import { getDict } from "@/lib/i18n/server";
import { flow, toMapPoint } from "@/lib/data";
import { kpis } from "@/lib/stats";
import { getReference } from "@/lib/reference";
import { heroGeometry } from "@/lib/hero-geo";
import { CATEGORY, DISTRICT, nm } from "@/lib/meta";

const STEP_ICONS = [Camera, Scale, ShieldCheck, Users];
const ROLE_ICONS = [UserRound, Wrench, Landmark];

export default async function Home() {
  const [{ lang, t }, { all, real }, ref] = await Promise.all([getDict(), flow(), getReference()]);
  const k = kpis(all);
  const h = t.home;
  const geo = heroGeometry(ref.districts, all, lang);
  const recent = real.slice(0, 5);

  return (
    <>
      <LiveRefresh />

      {/* 1. Первый экран — видео берега Каспия + живая карточка «путь жалобы» */}
      <section className="relative isolate flex min-h-[calc(100svh-3.5rem)] flex-col overflow-hidden bg-[#07131d] text-white">
        <HeroVideo />
        {/* лёгкий морской оттенок поверх ч/б видео */}
        <div className="pointer-events-none absolute inset-0 bg-[#0a2a40]/45 mix-blend-multiply" />
        <HeroMap
          cardOnly
          {...geo}
          areas={[]}
          coast={[]}
          lang={lang}
          labels={{ sent: h.heroSent, sla: h.heroSla, days: h.heroDays, done: h.heroDone, confirmed: h.heroConfirmed }}
        />
        {/* затемнение под текстом: слева на десктопе, снизу на телефоне */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07131d]/95 via-[#07131d]/55 to-[#07131d]/10 md:bg-gradient-to-r md:from-[#07131d]/90 md:via-[#07131d]/55 md:to-transparent" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-4 pt-56 pb-10 md:justify-center md:pt-24 md:pb-24">
          <p className="text-sm font-medium tracking-wide text-[#9fd0ff]">{h.kicker}</p>
          <h1 className="mt-3 max-w-2xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance md:text-6xl">{h.h1}</h1>
          <p className="mt-5 max-w-xl text-base text-white/75 text-pretty md:text-lg">{h.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 bg-[#e8f4ff] px-6 text-[#07131d] hover:bg-white">
              <Link href="/report/new">
                <Plus /> {h.ctaReport}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 border-white/25 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
              <Link href="/map">
                {h.ctaMap} <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>

        <a href="#how" className="relative mx-auto mb-6 hidden items-center gap-1 text-xs text-white/50 hover:text-white/80 md:flex">
          {h.scroll} <ChevronDown className="size-4" />
        </a>
      </section>

      {/* 2. Живые цифры */}
      <section className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{h.statsTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{h.statsSub}</p>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
            {[
              { v: k.total, l: h.sTotal },
              { v: k.resolved, l: h.sResolved, tone: "text-[color:var(--ok)]" },
              { v: k.breachedOpen, l: h.sBreached, tone: "text-[color:var(--danger)]" },
              { v: k.medianDays, l: h.sMedian, d: 1 },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className={`text-4xl font-semibold tracking-tight md:text-5xl ${s.tone ?? ""}`}>
                  <CountUp value={s.v} decimals={s.d ?? 0} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Почему это нужно — реальные истории Актау */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:py-24">
        <Reveal>
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance md:text-4xl">{h.whyTitle}</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground text-pretty">{h.whySub}</p>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {h.why.map(([big, text, src, url], i) => (
            <Reveal key={i} delay={i * 100}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="group flex h-full flex-col rounded-2xl border bg-card p-6 transition-colors hover:border-primary/40">
                <div className="text-3xl font-semibold tracking-tight text-[color:var(--danger)]">{big}</div>
                <p className="mt-3 flex-1 text-pretty">{text}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
                  {src} <ExternalLink className="size-3" />
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 4. Как это работает */}
      <section id="how" className="scroll-mt-16 border-y bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">{h.howTitle}</h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {h.how.map(([title, text], i) => {
              const Icon = STEP_ICONS[i];
              return (
                <Reveal key={i} delay={i * 100}>
                  <li className="flex h-full flex-col rounded-2xl border bg-card p-6">
                    <div className="flex items-center justify-between">
                      <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <span className="text-sm font-medium text-muted-foreground tabular-nums">0{i + 1}</span>
                    </div>
                    <div className="mt-5 text-lg font-semibold">{title}</div>
                    <p className="mt-2 text-sm text-muted-foreground text-pretty">{text}</p>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </section>

      {/* 5. Для кого */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:py-24">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">{h.rolesTitle}</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {h.roles.map(([title, text, href], i) => {
            const Icon = ROLE_ICONS[i];
            return (
              <Reveal key={i} delay={i * 100}>
                <Link href={href} className="group flex h-full flex-col rounded-2xl border bg-card p-6 transition-colors hover:border-primary/40">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="mt-5 text-lg font-semibold">{title}</div>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground text-pretty">{text}</p>
                  <ArrowRight className="mt-5 size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* 6. Живая карта и новые обращения */}
      <section className="border-t bg-muted/40">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-16 lg:grid-cols-[1fr_380px]">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="font-semibold">{h.liveTitle}</h2>
              <Link href="/map" className="text-sm text-primary hover:underline">
                {t.nav.map} →
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
          <div className="rounded-2xl border bg-card">
            <h2 className="border-b px-5 py-3 font-semibold">{t.landing.recent}</h2>
            <ul className="divide-y">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/report/${r.public_no}`} className="block px-5 py-3 hover:bg-accent/50">
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
        </div>
      </section>

      {/* 7. Призыв */}
      <section className="bg-[#07131d] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between md:py-20">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">{h.ctaTitle}</h2>
            <p className="mt-3 max-w-xl text-white/70 text-pretty">{h.ctaSub}</p>
            <p className="mt-4 flex items-center gap-2 text-sm text-white/50">
              <Building2 className="size-4" /> {h.notReplace}
            </p>
          </div>
          <Button asChild size="lg" className="h-12 shrink-0 bg-[#e8f4ff] px-6 text-[#07131d] hover:bg-white">
            <Link href="/report/new">
              <Plus /> {h.ctaReport}
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
