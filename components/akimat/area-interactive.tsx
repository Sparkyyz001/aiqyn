"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

type Row = { date: string; created: number; resolved: number };
const RANGES = [7, 30, 90] as const;

// Динамика обращений: поступило / решено по дням, с переключателем периода (как в консолях управления)
export function AreaInteractive({ data, labels }: { data: Row[]; labels: { title: string; sub: string; created: string; resolved: string; range: string } }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const rows = useMemo(() => data.slice(-range), [data, range]);
  const totals = rows.reduce((s, r) => ({ c: s.c + r.created, r: s.r + r.resolved }), { c: 0, r: 0 });
  const fmt = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-semibold">{labels.title}</h2>
          <p className="text-sm text-muted-foreground">{labels.sub.replace("{n}", String(range))}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--series-1)]" />{labels.created}: <b className="tabular-nums">{totals.c}</b></span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--series-2)]" />{labels.resolved}: <b className="tabular-nums">{totals.r}</b></span>
          </div>
        </div>
        <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label={labels.range}>
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn("rounded-md px-3 py-1 text-sm transition-colors duration-200", range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {r} {labels.range}
            </button>
          ))}
        </div>
      </div>
      <div className="h-72 w-full p-2 pt-4">
        <ResponsiveContainer>
          <AreaChart data={rows} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--series-1)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--series-1)" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="fillResolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--series-2)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--series-2)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" }}
              labelFormatter={(d) => fmt(String(d))}
              formatter={(v, name) => [v, name === "created" ? labels.created : labels.resolved]}
            />
            <Area type="monotone" dataKey="created" stroke="var(--series-1)" strokeWidth={2} fill="url(#fillCreated)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }} animationDuration={700} />
            <Area type="monotone" dataKey="resolved" stroke="var(--series-2)" strokeWidth={2} fill="url(#fillResolved)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }} animationDuration={700} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
