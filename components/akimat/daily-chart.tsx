"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { date: string; created: number; resolved: number };

// Динамика: поступило / решено по дням. Одна ось, две серии, легенда + подписи, crosshair-подсказка.
export function DailyChart({ data, labels }: { data: Row[]; labels: { created: string; resolved: string } }) {
  const fmt = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  const last = data[data.length - 1];
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--series-1)]" />{labels.created}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--series-2)]" />{labels.resolved}</span>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" }}
              labelFormatter={(d) => fmt(String(d))}
              formatter={(v, name) => [v, name === "created" ? labels.created : labels.resolved]}
            />
            <Line type="monotone" dataKey="created" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }} />
            <Line type="monotone" dataKey="resolved" stroke="var(--series-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {last && (
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {fmt(last.date)}: {labels.created.toLowerCase()} {last.created}, {labels.resolved.toLowerCase()} {last.resolved}
        </p>
      )}
    </div>
  );
}
