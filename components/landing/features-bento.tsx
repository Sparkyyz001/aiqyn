import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  FileText,
  Landmark,
  Mic,
  Sparkles,
  X,
} from "lucide-react";
import { Reveal } from "@/components/landing/motion";
import { fmt, type Dict } from "@/lib/i18n/dict";

type F = Dict["home"]["features"];
export type BentoData = {
  lots: number;
  bn: number;
  stuck: number;
  need: { d: string; n: number; m: string } | null;
  directions: { name: string; n: number }[];
  initiative: { title: string; votes: number } | null;
};

// «Что умеет AIQYN»: светлая секция-контраст на тёмном лендинге. В каждой карточке — живой
// мини-макет функции (не скриншот), цифры в макетах — из базы: закупки, «застряло из-за денег».
export function FeaturesBento({ f, d }: { f: F; d: BentoData }) {
  const [before, accent, after] = splitAccent(f.title);
  const maxDir = Math.max(1, ...d.directions.map((x) => x.n));
  return (
    <section className="relative overflow-hidden bg-lt-cream text-lt-deep">
      <style>{styles}</style>
      <div
        className="fb-grain pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
        <Reveal>
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.18em] text-lt-teal uppercase">
            <span className="h-px w-8 bg-lt-teal" aria-hidden />
            {f.kicker}
          </p>
          <h2 className="mt-5 max-w-4xl text-3xl leading-[1.08] font-semibold tracking-tight text-balance md:text-5xl">
            {before}
            <span className="font-serif font-normal tracking-normal text-lt-teal italic">
              {accent}
            </span>
            {after}
          </h2>
          <p className="mt-4 max-w-2xl text-lt-deep/70 text-pretty">{f.sub}</p>
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-6">
          {/* ИИ по фото — большая карточка с «телефоном» */}
          <Reveal from="left" className="lg:col-span-3 lg:row-span-2">
            <Card href="/report/new" open={f.open} className="h-full">
              <Head
                icon={<Sparkles />}
                title={f.photoT}
                text={f.photoD}
                tone="coral"
              />
              <div className="relative mt-6 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_50%_100%,rgb(118_207_106/0.28),rgb(7_84_88/0.07)_55%,transparent)] px-4 py-8">
                <div className="w-full max-w-[340px] rounded-[34px] border-[7px] border-lt-deep bg-white p-3 shadow-[0_30px_60px_-30px_rgb(5_62_66/0.55)]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-lt-deep/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/landing/pothole.webp"
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                    />
                    <div
                      className="fb-scan absolute inset-x-0 h-10"
                      aria-hidden
                    />
                    <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
                      15 мкр · 43.66, 51.14
                    </span>
                  </div>
                  <div className="mt-3 rounded-2xl border border-lt-teal/20 bg-lt-teal/[0.06] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-lt-teal">
                      <Sparkles className="size-3.5" /> {f.photoSees}
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {f.photoTitle}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-lt-deep/10">
                        <div className="fb-sev h-full rounded-full bg-gradient-to-r from-lt-green via-[#f2c14e] to-lt-coral" />
                      </div>
                      <span className="text-[11px] text-lt-deep/60 tabular-nums">
                        {f.photoSev}
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {f.photoChips.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-medium text-lt-deep/80 ring-1 ring-lt-deep/10"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>

          {/* Голос */}
          <Reveal delay={120} from="right" className="lg:col-span-3">
            <Card href="/report/new" open={f.open}>
              <Head
                icon={<Mic />}
                title={f.voiceT}
                text={f.voiceD}
                tone="teal"
              />
              <div className="mt-5 flex items-center gap-4 rounded-2xl bg-lt-deep p-4 text-lt-cream">
                <span className="relative grid size-11 shrink-0 place-items-center">
                  <span className="fb-ping absolute inset-0 rounded-full bg-lt-coral/40" />
                  <span className="relative grid size-11 place-items-center rounded-full bg-lt-coral text-lt-deep">
                    <Mic className="size-5" />
                  </span>
                </span>
                <div
                  className="flex h-9 flex-1 items-center gap-[3px]"
                  aria-hidden
                >
                  {Array.from({ length: 34 }, (_, i) => (
                    <span
                      key={i}
                      className="fb-bar w-[3px] rounded-full bg-lt-cream/80"
                      style={{ "--i": i } as React.CSSProperties}
                    />
                  ))}
                </div>
                <span className="text-xs text-lt-cream/60 tabular-nums">
                  0:07
                </span>
              </div>
              <p className="mt-3 text-sm text-lt-deep/75 italic text-pretty">
                {f.voiceQuote}
              </p>
            </Card>
          </Reveal>

          {/* До / после */}
          <Reveal delay={240} from="right" className="lg:col-span-3">
            <Card href="/map" open={f.open}>
              <Head
                icon={<Check />}
                title={f.checkT}
                text={f.checkD}
                tone="green"
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[f.before, f.after].map((label, i) => (
                  <div key={label} className="relative">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-lt-deep/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          i
                            ? "/landing/pothole-after.webp"
                            : "/landing/pothole.webp"
                        }
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </div>
                    <span className="absolute top-2 left-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                      {label}
                    </span>
                    {i === 1 && (
                      <span className="fb-stamp absolute -right-2 -bottom-2 grid size-9 place-items-center rounded-full bg-[#c8412f] text-white shadow-lg">
                        <X className="size-5" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-1.5 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-[#b3261e]">
                  <X className="size-3.5" /> {f.checkBad}
                </span>
                <span className="flex items-center gap-1.5 text-lt-deep/55">
                  <Check className="size-3.5 text-[#2f8f5b]" /> {f.checkOk}
                </span>
              </div>
            </Card>
          </Reveal>

          {/* Деньги и жалобы — реальные закупки */}
          <Reveal delay={80} from="scale" className="lg:col-span-2">
            <Card href="/budget" open={f.open} className="h-full">
              <Head
                icon={<Landmark />}
                title={f.moneyT}
                text={f.moneyD}
                tone="coral"
              />
              <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-lt-deep/10">
                <div className="text-[11px] font-medium text-lt-deep/55">
                  {fmt(f.moneyLots, {
                    n: d.lots,
                    b: d.bn.toFixed(1).replace(".", ","),
                  })}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-serif text-4xl leading-none text-[#b3261e] tabular-nums">
                    {d.stuck}
                  </span>
                  <span className="text-xs text-lt-deep/65">
                    {f.moneyStuck}
                  </span>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {d.directions.map((x) => (
                    <li
                      key={x.name}
                      className="grid grid-cols-[1fr_auto] items-center gap-2 text-[11px]"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="truncate text-lt-deep/75">
                          {x.name}
                        </span>
                        <span className="h-1.5 rounded-full bg-lt-deep/10">
                          <span
                            className="fb-grow block h-full rounded-full bg-lt-teal"
                            style={{ width: `${(x.n / maxDir) * 100}%` }}
                          />
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{x.n}</span>
                    </li>
                  ))}
                </ul>
                {d.need && (
                  <div className="mt-3 rounded-lg bg-[#b3261e]/[0.07] px-2.5 py-1.5 text-[11px] font-medium text-[#8f1f18]">
                    {fmt(f.moneyNeed, d.need)}
                  </div>
                )}
              </div>
            </Card>
          </Reveal>

          {/* Отчёт акиму */}
          <Reveal delay={200} from="scale" className="lg:col-span-2">
            <Card href="/akimat/digest" open={f.open} className="h-full">
              <Head
                icon={<FileText />}
                title={f.digestT}
                text={f.digestD}
                tone="teal"
              />
              <div className="mt-5 flex justify-center">
                <div className="fb-paper w-[210px] rotate-[-2.5deg] rounded-md bg-white p-4 shadow-[0_24px_40px_-22px_rgb(5_62_66/0.6)] ring-1 ring-lt-deep/10 transition-transform duration-500 group-hover:rotate-0">
                  <div className="text-[7px] font-bold tracking-[0.2em] text-lt-teal">
                    AIQYN · АҚТАУ
                  </div>
                  <div className="mt-1 h-1.5 w-4/5 rounded bg-lt-deep/80" />
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-5 rounded-sm ring-1 ${i === 2 ? "ring-[#b3261e]" : "ring-lt-deep/15"}`}
                      />
                    ))}
                  </div>
                  {[92, 70, 55, 38].map((w) => (
                    <div key={w} className="mt-1.5 flex items-center gap-1">
                      <div className="h-1 w-8 rounded bg-lt-deep/25" />
                      <div
                        className="h-1 rounded bg-[#b3261e]"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  ))}
                  <div className="mt-2.5 rounded-sm border border-[#b3261e] p-1.5">
                    <div className="text-[6.5px] font-bold text-[#b3261e]">
                      {f.digestRisk}
                    </div>
                    <div className="mt-1 h-1 w-full rounded bg-lt-deep/15" />
                    <div className="mt-0.5 h-1 w-3/4 rounded bg-lt-deep/15" />
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>

          {/* Бюджет народного участия */}
          <Reveal delay={320} from="scale" className="lg:col-span-2">
            <Card href="/initiatives" open={f.open} className="h-full">
              <Head
                icon={<Landmark />}
                title={f.budgetT}
                text={f.budgetD}
                tone="green"
              />
              {d.initiative && (
                <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-lt-deep/10">
                  <div className="line-clamp-2 text-sm font-semibold">
                    {d.initiative.title}
                  </div>
                  <div className="mt-3 flex items-baseline justify-between text-xs">
                    <span>
                      <b className="text-base tabular-nums">
                        {d.initiative.votes}
                      </b>{" "}
                      <span className="text-lt-deep/60">{f.budgetVotes}</span>
                    </span>
                    <span className="text-lt-deep/50 tabular-nums">
                      {Math.min(100, d.initiative.votes)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-lt-deep/10">
                    <div
                      className="fb-grow h-full rounded-full bg-gradient-to-r from-lt-teal to-lt-green"
                      style={{ width: `${Math.min(100, d.initiative.votes)}%` }}
                    />
                  </div>
                </div>
              )}
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function splitAccent(s: string): [string, string, string] {
  const m = s.match(/^(.*)\*(.+)\*(.*)$/);
  return m ? [m[1], m[2], m[3]] : [s, "", ""];
}

function Card({
  href,
  open,
  className = "",
  children,
}: {
  href: string;
  open: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={open}
      className={`group relative flex flex-col rounded-3xl border border-lt-deep/10 bg-white/70 p-6 shadow-[0_1px_0_rgb(255_255_255/0.8)_inset,0_18px_40px_-28px_rgb(5_62_66/0.45)] backdrop-blur transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1 hover:shadow-[0_1px_0_rgb(255_255_255/0.8)_inset,0_28px_50px_-26px_rgb(5_62_66/0.55)] md:p-7 ${className}`}
    >
      <span className="absolute top-5 right-5 grid size-8 place-items-center rounded-full bg-lt-deep/[0.06] text-lt-deep/60 transition-all duration-500 group-hover:rotate-45 group-hover:bg-lt-deep group-hover:text-lt-cream">
        <ArrowUpRight className="size-4" />
      </span>
      {children}
    </Link>
  );
}

function Head({
  icon,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: "coral" | "teal" | "green";
}) {
  const bg = {
    coral: "bg-lt-coral/20 text-[#b24a3a]",
    teal: "bg-lt-teal/12 text-lt-teal",
    green: "bg-lt-green/25 text-[#2f7a3b]",
  }[tone];
  return (
    <div className="pr-10">
      <span
        className={`grid size-10 place-items-center rounded-xl [&_svg]:size-5 ${bg}`}
      >
        {icon}
      </span>
      <h3 className="mt-4 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-lt-deep/65 text-pretty">{text}</p>
    </div>
  );
}

const styles = `
.fb-grain { background-image: radial-gradient(rgb(5 62 66 / 0.06) 1px, transparent 1px); background-size: 22px 22px; mask-image: linear-gradient(180deg, #000, transparent 70%); }
.fb-scan { top: -20%; background: linear-gradient(180deg, transparent, rgb(118 207 106 / 0.35), transparent); animation: fbScan 3.2s ease-in-out infinite; }
.fb-sev { width: 65%; transform-origin: left; animation: fbGrowX 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) both 0.3s; }
.fb-grow { transform-origin: left; animation: fbGrowX 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) both 0.2s; }
.fb-bar { height: 30%; animation: fbWave 1.1s ease-in-out infinite; animation-delay: calc(var(--i) * -73ms); }
.fb-ping { animation: fbPing 1.8s ease-out infinite; }
.fb-stamp { animation: fbStamp 2.8s ease-in-out infinite; }
@keyframes fbScan { 0% { top: -20%; } 55% { top: 100%; } 100% { top: 100%; } }
@keyframes fbGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes fbWave { 0%, 100% { height: 18%; } 25% { height: 85%; } 50% { height: 40%; } 75% { height: 70%; } }
@keyframes fbPing { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.9); opacity: 0; } }
@keyframes fbStamp { 0%, 60%, 100% { transform: scale(1) rotate(0); } 70% { transform: scale(1.18) rotate(-8deg); } 80% { transform: scale(1) rotate(0); } }
.reveal:not(.in) .fb-sev, .reveal:not(.in) .fb-grow, .reveal:not(.in) .fb-stamp { animation-play-state: paused; }
`;
