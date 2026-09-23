import { cn } from "@/lib/utils";

export function Kpi({ label, value, tone, hint }: { label: string; value: string | number; tone?: "danger" | "ok" | "warn"; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div
        className={cn(
          "text-2xl font-semibold tabular-nums tracking-tight md:text-3xl",
          tone === "danger" && "text-[color:var(--danger)]",
          tone === "ok" && "text-[color:var(--ok)]",
          tone === "warn" && "text-[color:var(--warn)]"
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
