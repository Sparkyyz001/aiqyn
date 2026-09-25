"use client";

import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, Copy, MapPin, Plus, Siren } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/reports/share-button";
import type { Created } from "@/lib/actions/reports";
import { fmt, type Dict, type Lang } from "@/lib/i18n/dict";

type D = Dict["report"]["done"];

// Экран «Обращение принято»: рисующаяся галочка, номер, кто получил и срок по закону,
// что будет дальше. Житель видит результат, а не просто переход на другую страницу.
export function ReportSuccess({ c, lang, d, share, onAnother }: { c: Created; lang: Lang; d: D; share: Dict["share"]; onAnother: () => void }) {
  const kz = lang === "kz";
  const due = new Date(c.sla_due_at).toLocaleDateString(kz ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Aqtau" });
  const copy = () => {
    navigator.clipboard?.writeText(c.public_no).then(() => toast.success(d.copied), () => {});
  };
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:py-14">
      <style>{styles}</style>
      <div className="rs-card relative overflow-hidden rounded-[28px] border bg-card p-6 text-center shadow-[0_30px_70px_-40px_rgb(5_62_66/0.6)] md:p-10">
        <div className="rs-burst pointer-events-none absolute inset-x-0 top-10 mx-auto size-40" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ "--a": `${i * (360 / 14)}deg`, "--c": ["#ff907d", "#76cf6a", "#075458", "#f2c14e"][i % 4] } as React.CSSProperties} />
          ))}
        </div>

        <svg className="rs-check relative mx-auto size-24" viewBox="0 0 96 96" aria-hidden>
          <circle cx="48" cy="48" r="44" className="rs-ring" />
          <path d="M29 49 l13 13 l26 -28" className="rs-tick" />
        </svg>

        <h1 className="rs-in mt-5 text-2xl font-semibold tracking-tight md:text-3xl" style={{ "--d": "700ms" } as React.CSSProperties}>
          {d.title}
        </h1>
        <p className="rs-in mt-2 text-muted-foreground text-pretty" style={{ "--d": "820ms" } as React.CSSProperties}>
          {d.sub}
        </p>

        <button
          type="button"
          onClick={copy}
          title={d.copy}
          className="rs-in group mx-auto mt-5 inline-flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-2 font-mono text-lg font-semibold tracking-wide transition-colors hover:bg-muted"
          style={{ "--d": "940ms" } as React.CSSProperties}
        >
          {c.public_no}
          <Copy className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        </button>

        <div className="mt-7 grid gap-3 text-left sm:grid-cols-3">
          {[
            { icon: <Building2 />, l: d.service, v: kz ? c.service.name_kz : c.service.name_ru },
            { icon: <CalendarClock />, l: d.due, v: due },
            { icon: <MapPin />, l: d.district, v: c.district ? (kz ? c.district.name_kz : c.district.name_ru) : "—" },
          ].map((x, i) => (
            <div key={x.l} className="rs-in rounded-2xl border bg-background/60 p-3.5" style={{ "--d": `${1060 + i * 110}ms` } as React.CSSProperties}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
                {x.icon} {x.l}
              </div>
              <div className="mt-1 text-sm leading-snug font-semibold">{x.v}</div>
            </div>
          ))}
        </div>

        {c.incident && (
          <div className="rs-in mt-3 flex items-center gap-2 rounded-xl border border-[#b4447a]/35 bg-[#b4447a]/5 px-3 py-2 text-left text-sm" style={{ "--d": "1400ms" } as React.CSSProperties}>
            <Siren className="size-4 shrink-0 text-[#b4447a]" /> {fmt(d.incident, { t: c.incident })}
          </div>
        )}

        <div className="rs-in mt-7 rounded-2xl bg-muted/40 p-4 text-left" style={{ "--d": "1450ms" } as React.CSSProperties}>
          <div className="text-sm font-semibold">{d.nextTitle}</div>
          <ol className="mt-3 flex flex-col gap-3">
            {d.next.map((x, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{i + 1}</span>
                <span className="text-pretty">{x}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rs-in mt-7 flex flex-col items-center gap-3" style={{ "--d": "1600ms" } as React.CSSProperties}>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="lg" className="btn-shine rounded-full px-6">
              <Link href={`/report/${c.public_no}`}>
                {d.open} <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-6" onClick={onAnother}>
              <Plus /> {d.another}
            </Button>
          </div>
          <div className="flex justify-center text-center [&>div]:items-center">
            <ShareButton no={c.public_no} lang={lang} t={share} />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = `
.rs-card { animation: rsCard 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
.rs-ring { fill: none; stroke: var(--ok, #2f8f5b); stroke-width: 5; stroke-dasharray: 277; stroke-dashoffset: 277; transform: rotate(-90deg); transform-origin: center; animation: rsDraw 0.8s cubic-bezier(0.65, 0, 0.35, 1) 0.15s forwards; }
.rs-tick { fill: none; stroke: var(--ok, #2f8f5b); stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 64; stroke-dashoffset: 64; animation: rsDraw 0.45s cubic-bezier(0.65, 0, 0.35, 1) 0.8s forwards; }
.rs-check { animation: rsPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.95s both; }
.rs-in { opacity: 0; transform: translateY(14px); animation: rsIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: var(--d, 0ms); }
.rs-burst span { position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; margin: -4px; border-radius: 2px; background: var(--c); opacity: 0;
  animation: rsBurst 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.95s forwards; }
@keyframes rsCard { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes rsDraw { to { stroke-dashoffset: 0; } }
@keyframes rsPop { 0% { transform: scale(1); } 45% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes rsIn { to { opacity: 1; transform: none; } }
@keyframes rsBurst {
  0% { opacity: 1; transform: rotate(var(--a)) translateY(0) scale(1); }
  100% { opacity: 0; transform: rotate(var(--a)) translateY(-86px) scale(0.4) rotate(160deg); }
}
`;
