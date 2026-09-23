"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, MapPin, Send } from "lucide-react";
import { CATEGORY, DISTRICT, SERVICE, nm } from "@/lib/meta";
import type { HeroDot } from "@/lib/hero-geo";
import type { Lang } from "@/lib/i18n/dict";

type Labels = { sent: string; sla: string; days: string; done: string; confirmed: string };

// Анимация первого экрана: из темноты проступает Актау (реальные границы микрорайонов и берег
// Каспия), загораются обращения, и по очереди одно из них «проживает» путь жалобы:
// подано → передано службе → идёт срок по закону → сделано → жители подтвердили (точка зеленеет).
export function HeroMap({ w, h, areas, coast, dots, lang, labels }: { w: number; h: number; areas: string[]; coast: string[]; dots: HeroDot[]; lang: Lang; labels: Labels }) {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [phase, setPhase] = useState(0); // 0 подано, 1 передано, 2 срок идёт, 3 решено
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const [days, setDays] = useState(15);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Кандидаты для истории: открытые и просроченные, разные категории по очереди
  const queue = useMemo(() => {
    const idx = dots.map((d, i) => ({ d, i })).filter((x) => x.d.s !== "done");
    const byCat = new Map<string, number[]>();
    for (const x of idx) byCat.set(x.d.c, [...(byCat.get(x.d.c) ?? []), x.i]);
    const lists = [...byCat.values()];
    const out: number[] = [];
    for (let k = 0; out.length < 40 && k < 40; k++) for (const l of lists) if (l[k] != null) out.push(l[k]);
    return out;
  }, [dots]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (reduced || !queue.length) return;
    let n = 0;
    const clear = () => timers.current.forEach(clearTimeout);
    const run = () => {
      const i = queue[n % queue.length];
      n++;
      setActive(i);
      setPhase(0);
      setDays(15);
      const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
      at(1100, () => setPhase(1));
      at(2200, () => setPhase(2));
      // срок «тикает»: 15 → 4 рабочих дня
      for (let k = 1; k <= 11; k++) at(2200 + k * 110, () => setDays(15 - k));
      at(3800, () => {
        setPhase(3);
        setSolved((s) => new Set(s).add(i));
      });
      at(5600, run);
    };
    timers.current.push(setTimeout(run, 2600)); // старт после проявления карты
    return clear;
  }, [queue, reduced]);

  const a = active != null ? dots[active] : null;
  const color = (d: HeroDot, i: number) => (solved.has(i) || d.s === "done" ? "#3fbf7f" : d.s === "late" ? "#ef6b4a" : "#5aa9e6");

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* на десктопе карта — правые две трети экрана, слева текст */}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full md:left-[34%] md:w-[66%]">
        {/* берег Каспия */}
        {coast.map((d, i) => (
          <path key={`c${i}`} d={d} pathLength={1} fill="none" stroke="#6fb7e8" strokeOpacity={0.55} strokeWidth={2.2} className={reduced ? "" : "hero-draw"} style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
        {/* микрорайоны */}
        {areas.map((d, i) => (
          <path
            key={`a${i}`}
            d={d}
            fill="#9fd0ff"
            fillOpacity={0.035}
            stroke="#9fd0ff"
            strokeOpacity={0.28}
            strokeWidth={1}
            pathLength={1}
            className={reduced ? "" : "hero-draw"}
            style={{ animationDelay: `${0.3 + (i % 20) * 0.04}s` }}
          />
        ))}
        {/* обращения */}
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={i === active ? 8 : 4.5}
            fill={color(d, i)}
            fillOpacity={i === active ? 1 : 0.8}
            className="transition-[r,fill] duration-500"
            style={reduced ? undefined : { opacity: ready ? 1 : 0, transition: `opacity .5s ease ${1.2 + (i % 60) * 0.02}s, r .4s, fill .6s` }}
          />
        ))}
        {/* кольцо вокруг активной точки — одно мягкое расхождение, без постоянного мигания */}
        {a && (
          <circle key={`ring${active}-${phase}`} cx={a.x} cy={a.y} r={12} fill="none" stroke={phase === 3 ? "#3fbf7f" : "#e8f4ff"} strokeWidth={2.5} className="hero-ring" />
        )}
      </svg>

      {/* карточка текущей истории */}
      {a && !reduced && (
        <div className="absolute top-4 right-4 left-4 mx-auto max-w-sm rounded-xl border border-white/10 bg-[#0c1e2c]/85 p-3.5 text-sm text-white shadow-2xl backdrop-blur md:top-auto md:right-10 md:bottom-12 md:left-auto md:w-80 md:p-4">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[#9fd0ff]" />
            <div className="min-w-0">
              <div className="line-clamp-2 font-medium">{a.t}</div>
              <div className="text-xs text-white/60">
                {nm(CATEGORY[a.c], lang)}
                {a.d && DISTRICT[a.d] ? ` · ${nm(DISTRICT[a.d], lang)}` : ""}
              </div>
            </div>
          </div>
          <ol className="mt-3 space-y-1.5 text-xs">
            <li className={`flex items-center gap-2 transition-opacity duration-300 ${phase >= 1 ? "opacity-100" : "opacity-30"}`}>
              <Send className="size-3.5 text-[#9fd0ff]" /> {labels.sent} <b className="font-medium">{SERVICE[a.sv]?.short}</b>
            </li>
            <li className={`flex items-center gap-2 transition-opacity duration-300 ${phase >= 2 ? "opacity-100" : "opacity-30"}`}>
              <Clock className="size-3.5 text-[#f2c26b]" /> {labels.sla}: <b className="font-medium tabular-nums">{days}</b> {labels.days}
              <span className="ml-auto h-1 w-16 overflow-hidden rounded bg-white/10">
                <span className="block h-full bg-[#f2c26b] transition-[width] duration-150" style={{ width: `${(days / 15) * 100}%` }} />
              </span>
            </li>
            <li className={`flex items-center gap-2 transition-opacity duration-300 ${phase >= 3 ? "opacity-100 text-[#7fe0ad]" : "opacity-30"}`}>
              <Check className="size-3.5" /> {labels.done} · {labels.confirmed}
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
