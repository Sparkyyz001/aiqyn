"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

export type TableRow = {
  no: string;
  title: string;
  cat: string;
  district: string;
  service: string;
  status: string;
  statusLabel: string;
  due: string | null;
  breached: boolean;
  risk: number | null;
  priority: number;
};

type Tab = "open" | "breached" | "risk" | "awaiting";
type L = { tabs: Record<Tab, string>; search: string; cols: { report: string; service: string; status: string; due: string; risk: string; priority: string }; empty: string; page: string };

// Таблица обращений для акимата: вкладки, поиск, страницы. Клик — карточка обращения.
export function ReportsTable({ rows, l, lang }: { rows: TableRow[]; l: L; lang: "ru" | "kz" }) {
  const [tab, setTab] = useState<Tab>("open");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const PER = 10;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => (tab === "breached" ? r.breached : tab === "risk" ? !r.breached && (r.risk ?? 0) >= 0.5 : tab === "awaiting" ? r.status === "awaiting_confirmation" : true))
      .filter((r) => !s || `${r.no} ${r.title} ${r.district} ${r.service} ${r.cat}`.toLowerCase().includes(s))
      .sort((a, b) => (tab === "risk" ? (b.risk ?? 0) - (a.risk ?? 0) : b.priority - a.priority));
  }, [rows, tab, q]);
  const counts: Record<Tab, number> = {
    open: rows.length,
    breached: rows.filter((r) => r.breached).length,
    risk: rows.filter((r) => !r.breached && (r.risk ?? 0) >= 0.5).length,
    awaiting: rows.filter((r) => r.status === "awaiting_confirmation").length,
  };
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const view = filtered.slice(page * PER, page * PER + PER);
  const d = (iso: string) => new Date(iso).toLocaleDateString(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Aqtau" });

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {(Object.keys(l.tabs) as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => (setTab(k), setPage(0))}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors duration-200", tab === k ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {l.tabs[k]}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", k === "breached" || k === "risk" ? "bg-[color:var(--danger)]/12 text-[color:var(--danger)]" : "bg-foreground/10")}>{counts[k]}</span>
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} placeholder={l.search} className="h-9 w-full rounded-md border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        </label>
      </div>

      {/* телефон: карточки вместо широкой таблицы — видно статус, срок и риск без прокрутки вбок */}
      <ul className="divide-y md:hidden">
        {view.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">{l.empty}</li>}
        {view.map((r) => (
          <li key={r.no}>
            <Link href={`/report/${r.no}`} className="block px-3 py-3 active:bg-accent">
              <div className="flex items-start justify-between gap-3">
                <span className="line-clamp-2 text-[15px] leading-snug font-medium">{r.title}</span>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums" title={l.cols.priority}>
                  {Math.round(r.priority)}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-mono">{r.no}</span> · {r.cat} · {r.district}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                <StatusBadge status={r.status} label={r.statusLabel} />
                <span className="text-muted-foreground">{r.service}</span>
                <span className={cn("tabular-nums", r.breached ? "font-semibold text-[color:var(--danger)]" : "text-muted-foreground")}>
                  {l.cols.due}: {r.due ? d(r.due) : "—"}
                </span>
                {r.risk != null && (
                  <span className={cn("ml-auto tabular-nums", r.risk >= 0.5 ? "font-semibold text-[color:var(--danger)]" : r.risk >= 0.3 ? "text-[color:var(--warn)]" : "text-muted-foreground")}>
                    {l.cols.risk} {Math.round(r.risk * 100)}%
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th>{l.cols.report}</th>
              <th>{l.cols.service}</th>
              <th>{l.cols.status}</th>
              <th>{l.cols.due}</th>
              <th className="!text-right">{l.cols.risk}</th>
              <th className="!text-right">{l.cols.priority}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {view.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{l.empty}</td>
              </tr>
            )}
            {view.map((r) => (
              <tr key={r.no} className="transition-colors hover:bg-accent/50">
                <td className="max-w-[22rem] px-3 py-2.5">
                  <Link href={`/report/${r.no}`} className="block">
                    <span className="line-clamp-1 font-medium hover:underline">{r.title}</span>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-mono">{r.no}</span> · {r.cat} · {r.district}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-xs">{r.service}</td>
                <td className="px-3 py-2.5"><StatusBadge status={r.status} label={r.statusLabel} /></td>
                <td className={cn("px-3 py-2.5 tabular-nums", r.breached && "font-medium text-[color:var(--danger)]")}>{r.due ? d(r.due) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.risk == null ? "—" : <span className={cn(r.risk >= 0.5 ? "font-semibold text-[color:var(--danger)]" : r.risk >= 0.3 ? "text-[color:var(--warn)]" : "text-muted-foreground")}>{Math.round(r.risk * 100)}%</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{Math.round(r.priority)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="tabular-nums">{l.page.replace("{a}", String(page + 1)).replace("{b}", String(pages)).replace("{n}", String(filtered.length))}</span>
        <div className="flex gap-1">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="grid size-8 place-items-center rounded-md border disabled:opacity-40" aria-label="‹">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="grid size-8 place-items-center rounded-md border disabled:opacity-40" aria-label="›">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
