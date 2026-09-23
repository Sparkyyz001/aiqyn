"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Динамика индекса района: одна серия, одна ось 0–100, подсказка по наведению
export function PainHistoryChart({ data, label }: { data: { date: string; index: number | null }[]; label: string }) {
  const fmt = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  // Ровные деления по 25: верх оси — не меньше 100 (шкала «100 = худший район сегодня»)
  const top = Math.max(100, Math.ceil(Math.max(0, ...data.map((d) => d.index ?? 0)) / 25) * 25);
  const ticks = Array.from({ length: top / 25 + 1 }, (_, i) => i * 25);
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis domain={[0, top]} ticks={ticks} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={32} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" }}
            labelFormatter={(d) => fmt(String(d))}
            formatter={(v) => [v ?? "—", label]}
          />
          <Line type="monotone" dataKey="index" stroke="var(--series-1)" strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
