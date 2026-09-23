import { cn } from "@/lib/utils";

// Плитка показателя: цветной акцент — диагональный градиент оттенка к прозрачному,
// рамка того же тона, иконка в квадратном чипе, мягкий подъём на наведении.
const ACCENT = {
  base: {
    wrap: "border-[#075458]/25 bg-[linear-gradient(135deg,rgb(7_84_88/0.09)_0%,rgb(7_84_88/0)_62%)] dark:border-[#4fb3a9]/25 dark:bg-[linear-gradient(135deg,rgb(79_179_169/0.12)_0%,rgb(79_179_169/0)_62%)]",
    icon: "bg-[#075458]/10 text-[#075458] dark:bg-[#4fb3a9]/15 dark:text-[#7fd6cc]",
    value: "",
  },
  danger: {
    wrap: "border-[color:var(--danger)]/30 bg-[linear-gradient(135deg,rgb(220_80_60/0.10)_0%,rgb(220_80_60/0)_62%)]",
    icon: "bg-[color:var(--danger)]/12 text-[color:var(--danger)]",
    value: "text-[color:var(--danger)]",
  },
  warn: {
    wrap: "border-[color:var(--warn)]/35 bg-[linear-gradient(135deg,rgb(230_160_40/0.12)_0%,rgb(230_160_40/0)_62%)]",
    icon: "bg-[color:var(--warn)]/14 text-[color:var(--warn)]",
    value: "text-[color:var(--warn)]",
  },
  ok: {
    wrap: "border-[color:var(--ok)]/30 bg-[linear-gradient(135deg,rgb(60_160_100/0.10)_0%,rgb(60_160_100/0)_62%)]",
    icon: "bg-[color:var(--ok)]/12 text-[color:var(--ok)]",
    value: "text-[color:var(--ok)]",
  },
};

export function Kpi({
  label,
  value,
  tone,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  tone?: "danger" | "ok" | "warn";
  hint?: string;
  icon?: React.ReactNode;
}) {
  const a = ACCENT[tone ?? "base"];
  return (
    <div className={cn("flex flex-col rounded-xl border bg-card p-4 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgb(5_62_66/0.45)]", a.wrap)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm leading-snug text-muted-foreground">{label}</div>
        {icon ? <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4", a.icon)}>{icon}</span> : null}
      </div>
      <div className={cn("mt-auto pt-3 text-3xl font-bold tracking-tight tabular-nums", a.value)}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
