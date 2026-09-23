// Горизонтальные бары на HTML: читаются на телефоне, значения — текстом (не цветом),
// просроченная доля показана вторым сегментом с подписью в строке.
export function BarList({
  rows,
  max,
  breachedLabel,
}: {
  rows: { label: string; total: number; breached: number; href?: string }[];
  max?: number;
  breachedLabel: string;
}) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.total));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 text-sm sm:grid-cols-[minmax(0,11rem)_1fr_auto]" title={`${r.label}: ${r.total}, ${breachedLabel.toLowerCase()} ${r.breached}`}>
          <span className="truncate sm:order-none">{r.label}</span>
          <span className="order-last col-span-2 flex h-2.5 overflow-hidden rounded-sm bg-muted sm:order-none sm:col-span-1">
            <span className="h-full bg-[var(--series-1)]" style={{ width: `${((r.total - r.breached) / m) * 100}%` }} />
            <span className="h-full border-l-2 border-card bg-[color:var(--danger)]" style={{ width: `${(r.breached / m) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted-foreground">
            {r.total}
            {r.breached > 0 && <span className="text-[color:var(--danger)]"> · {r.breached}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
