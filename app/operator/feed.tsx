"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, AtSign, Camera, ChevronDown, Headset, PhoneCall } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

export type FeedItem = { no: string; title: string; meta: string; source: string; status: string; statusLabel: string; created: string; breached: boolean; due: string | null };
type L = {
  ch: Record<string, string>;
  all: string;
  fNew: string;
  fWork: string;
  fLate: string;
  today: string;
  yesterday: string;
  earlier: string;
  more: string;
  empty: string;
  late: string;
  due: string;
};

const CH: Record<string, { icon: typeof Camera; tone: string }> = {
  app: { icon: Camera, tone: "bg-primary/12 text-primary" },
  call109: { icon: PhoneCall, tone: "bg-[color:var(--warn)]/15 text-[color:var(--warn)]" },
  instagram: { icon: AtSign, tone: "bg-[#c13584]/12 text-[#c13584]" },
  operator: { icon: Headset, tone: "bg-muted text-muted-foreground" },
};
const WORK = ["accepted", "in_progress", "reopened"];

// Входящий поток пульта 109: карточки вместо сжатых строк, фильтр по каналу и состоянию,
// группировка «сегодня / вчера / раньше» — оператор не теряется в ленте на телефоне.
export function OperatorFeed({ items, l, lang }: { items: FeedItem[]; l: L; lang: "ru" | "kz" }) {
  const [ch, setCh] = useState<string>("all");
  const [st, setSt] = useState<string>("all");
  const [limit, setLimit] = useState(30);
  const now = useMemo(() => new Date().getTime(), []);

  const list = items.filter(
    (i) =>
      (ch === "all" || i.source === ch) &&
      (st === "all" || (st === "new" && (i.status === "routed" || i.status === "new")) || (st === "work" && WORK.includes(i.status)) || (st === "late" && i.breached))
  );
  const count = (f: (i: FeedItem) => boolean) => items.filter(f).length;
  const ago = (iso: string) => {
    const m = Math.round((now - new Date(iso).getTime()) / 60000);
    const rtf = new Intl.RelativeTimeFormat(lang === "kz" ? "kk" : "ru", { numeric: "auto" });
    return m < 60 ? rtf.format(-Math.max(m, 1), "minute") : m < 1440 ? rtf.format(-Math.round(m / 60), "hour") : rtf.format(-Math.round(m / 1440), "day");
  };
  const dayKey = (iso: string) => {
    const d = new Date(iso);
    const t = new Date(now);
    const diff = Math.floor((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
    return diff <= 0 ? l.today : diff === 1 ? l.yesterday : l.earlier;
  };

  const shown = list.slice(0, limit);
  const groups: [string, FeedItem[]][] = [];
  for (const i of shown) {
    const k = dayKey(i.created);
    const g = groups.find(([x]) => x === k);
    if (g) g[1].push(i);
    else groups.push([k, [i]]);
  }

  const chip = (active: boolean) =>
    cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent");

  return (
    <div>
      <div className="flex flex-col gap-2 border-b px-4 py-3">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
          {[["all", l.all] as const, ...Object.keys(CH).map((k) => [k, l.ch[k] ?? k] as const)].map(([k, label]) => {
            const n = k === "all" ? items.length : count((i) => i.source === k);
            if (k !== "all" && n === 0) return null;
            const Icon = k === "all" ? null : CH[k].icon;
            return (
              <button key={k} type="button" className={chip(ch === k)} onClick={() => { setCh(k); setLimit(30); }}>
                {Icon && <Icon className="size-3.5" />} {label} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
          {[
            ["all", l.all, items.length],
            ["new", l.fNew, count((i) => i.status === "routed" || i.status === "new")],
            ["work", l.fWork, count((i) => WORK.includes(i.status))],
            ["late", l.fLate, count((i) => i.breached)],
          ].map(([k, label, n]) => (
            <button key={k as string} type="button" className={cn(chip(st === k), k === "late" && st !== k && "text-[color:var(--danger)]")} onClick={() => { setSt(k as string); setLimit(30); }}>
              {label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">{l.empty}</p>}
      {groups.map(([g, rows]) => (
        <div key={g}>
          <div className="sticky top-14 z-10 border-b bg-muted/80 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur md:top-0">{g}</div>
          <ul className="divide-y">
            {rows.map((r) => {
              const c = CH[r.source] ?? CH.app;
              const Icon = c.icon;
              return (
                <li key={r.no}>
                  <Link href={`/report/${r.no}`} className="block px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", c.tone)}>
                        <Icon className="size-3" /> {l.ch[r.source] ?? r.source}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{ago(r.created)}</span>
                    </div>
                    <div className="mt-1.5 line-clamp-2 text-[15px] leading-snug font-medium">{r.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{r.meta}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.status} label={r.statusLabel} />
                      {r.breached ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--danger)]">
                          <AlertTriangle className="size-3" /> {l.late}
                        </span>
                      ) : r.due ? (
                        <span className="text-[11px] text-muted-foreground">
                          {l.due} {new Date(r.due).toLocaleDateString(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Aqtau" })}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {list.length > limit && (
        <button type="button" onClick={() => setLimit((x) => x + 30)} className="flex w-full items-center justify-center gap-1 border-t py-3 text-sm font-medium text-primary hover:bg-accent/50">
          {l.more} ({list.length - limit}) <ChevronDown className="size-4" />
        </button>
      )}
    </div>
  );
}
