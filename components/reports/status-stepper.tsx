import { Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Labels = { filed: string; routed: string; work: string; check: string; resolved: string; rejected: string; reopened: string };

const STEP_OF: Record<string, number> = { new: 0, routed: 1, accepted: 2, in_progress: 2, reopened: 2, awaiting_confirmation: 3, resolved: 4, rejected: 1 };

// Путь заявки одной полосой: где она сейчас и что дальше. Текущий шаг подсвечен,
// переоткрытие и отказ видны сразу — без чтения хронологии.
export function StatusStepper({ status, reopenCount = 0, dates, l }: { status: string; reopenCount?: number; dates: (string | null)[]; l: Labels }) {
  const cur = STEP_OF[status] ?? 0;
  const rejected = status === "rejected";
  const steps = [l.filed, l.routed, l.work, l.check, l.resolved];
  const d = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Asia/Aqtau" }) : "";
  return (
    <ol className="relative grid grid-cols-5 gap-1" aria-label={steps[cur]}>
      {steps.map((label, i) => {
        const done = i < cur || (i === cur && status === "resolved");
        const now = i === cur && !done;
        const last = i === steps.length - 1;
        return (
          <li key={label} className="relative flex flex-col items-center text-center" aria-current={now ? "step" : undefined}>
            {!last && (
              <span className="absolute top-[15px] left-1/2 h-0.5 w-full bg-border" aria-hidden>
                <span className={cn("block h-full origin-left bg-primary transition-transform duration-700", i < cur ? "scale-x-100" : "scale-x-0")} />
              </span>
            )}
            <span
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full border-2 text-xs font-semibold transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                now && !rejected && "border-[color:var(--warn)] bg-background text-[color:var(--warn)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--warn)_18%,transparent)]",
                now && rejected && "border-[color:var(--danger)] bg-[color:var(--danger)] text-white",
                !done && !now && "border-border bg-background text-muted-foreground"
              )}
            >
              {done ? <Check className="size-4" /> : now && rejected ? <X className="size-4" /> : now && status === "reopened" ? <RotateCcw className="size-4" /> : i + 1}
              {now && !rejected && <span className="absolute inset-0 animate-ping rounded-full border-2 border-[color:var(--warn)] opacity-40" aria-hidden />}
            </span>
            <span className={cn("mt-1.5 text-[11px] leading-tight text-balance sm:text-xs", now ? "font-semibold text-foreground" : done ? "text-foreground/80" : "text-muted-foreground")}>
              {now && rejected ? l.rejected : label}
            </span>
            {now && status === "reopened" && reopenCount > 0 && (
              <span className="mt-0.5 text-[10px] font-medium text-[color:var(--danger)]">
                {l.reopened} ×{reopenCount}
              </span>
            )}
            {!now && dates[i] && <span className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{d(dates[i])}</span>}
          </li>
        );
      })}
    </ol>
  );
}
