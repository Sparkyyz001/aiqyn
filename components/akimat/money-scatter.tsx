"use client";

import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

type P = { name: string; mln: number; reports: number; breached: number };

// Деньги ↔ жалобы по микрорайонам: справа вверху — «деньги выделены, а жалобы остались»,
// слева вверху — «жалоб много, денег мало». Линии — медианы по городу.
export function MoneyScatter({ data, l }: { data: P[]; l: { x: string; y: string; breached: string; mln: string } }) {
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1] ?? 0;
  const mx = med(data.map((d) => d.mln));
  const my = med(data.map((d) => d.reports));
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis type="number" dataKey="mln" name={l.x} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} label={{ value: l.x, position: "insideBottom", offset: -14, fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis type="number" dataKey="reports" name={l.y} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
          <ZAxis type="number" dataKey="breached" range={[60, 360]} />
          <ReferenceLine x={mx} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />
          <ReferenceLine y={my} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as P | undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <div className="font-semibold">{p.name}</div>
                  <div className="mt-1 tabular-nums">{l.x}: {p.mln.toLocaleString("ru-RU")} {l.mln}</div>
                  <div className="tabular-nums">{l.y}: {p.reports}</div>
                  <div className="tabular-nums text-[color:var(--danger)]">{l.breached}: {p.breached}</div>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="var(--series-1)" fillOpacity={0.75} stroke="var(--background)" strokeWidth={1.5} animationDuration={700} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
