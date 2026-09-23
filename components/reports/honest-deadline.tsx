import { AlertTriangle, Gavel, Info, LineChart } from "lucide-react";
import { fmt, type Dict } from "@/lib/i18n/dict";
import { workingDaysBetween } from "@/lib/sla";
import { honestMetrics, type HonestForecast } from "@/lib/honest-deadline";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;
const dateStr = (iso: string, lang: "ru" | "kz") =>
  new Date(iso).toLocaleDateString(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Aqtau" });

// Два срока рядом: официальный по закону и честный прогноз по статистике.
// Житель узнаёт правду в момент подачи, а не через полтора месяца ожидания.
export function HonestDeadline({ f, dueAt, t, lang, now = new Date() }: { f: HonestForecast; dueAt: string | null; t: Dict["honest"]; lang: "ru" | "kz"; now?: Date }) {
  const due = dueAt ? new Date(dueAt) : null;
  const wdLeft = due ? workingDaysBetween(now, due) : null;
  const breachedNow = due ? due.getTime() < now.getTime() : false;
  const risky = f.ok && f.pBreach != null && f.pBreach >= 0.5;
  const pct = Math.round(honestMetrics.improvement_vs_official_pct);
  const cover = Math.round(honestMetrics.interval_10_90_coverage * 100);
  const rows = new Intl.NumberFormat("ru-RU").format(honestMetrics.train_rows + honestMetrics.test_rows);

  return (
    <section className="overflow-hidden rounded-2xl border">
      <div className="grid sm:grid-cols-2">
        {/* Срок по закону */}
        <div className="border-b p-4 sm:border-r sm:border-b-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <Gavel className="size-3.5" /> {t.legal}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{due ? dateStr(due.toISOString(), lang) : "—"}</div>
          <div className={cn("mt-1 text-sm", breachedNow ? "font-medium text-[color:var(--danger)]" : "text-[color:var(--ok)]")}>
            {breachedNow ? t.overdue : wdLeft != null ? fmt(t.left, { n: Math.max(0, wdLeft) }) : ""}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{t.legalNote}</div>
        </div>

        {/* Честный прогноз */}
        <div className={cn("p-4", risky ? "bg-[color:var(--danger)]/[0.06]" : "bg-[color:var(--ok)]/[0.05]")}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <LineChart className="size-3.5" /> {t.forecast}
          </div>
          {f.ok ? (
            <>
              <div className={cn("mt-2 text-2xl font-semibold tracking-tight", risky ? "text-[color:var(--danger)]" : "")}>{dateStr(f.date, lang)}</div>
              <div className={cn("mt-1 text-sm font-medium", risky ? "text-[color:var(--danger)]" : "text-[color:var(--ok)]")}>
                {f.lateBy == null ? "" : f.lateBy > 1 ? fmt(t.later, { n: f.lateBy }) : f.lateBy < -1 ? fmt(t.earlier, { n: -f.lateBy }) : t.onTime}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{fmt(t.range, { lo: dateStr(f.lo, lang), hi: dateStr(f.hi, lang) })}</div>
              <div className="text-xs text-muted-foreground">{fmt(t.basis, { n: f.n })}</div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{fmt(t.few, { n: f.n })}</p>
          )}
        </div>
      </div>

      {risky && due && (
        <div className="flex items-start gap-2 border-t bg-[color:var(--danger)]/[0.06] px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[color:var(--danger)]" />
          <div>
            <div className="font-medium">{fmt(t.warn, { p: Math.round(f.pBreach! * 100) })}</div>
            {!breachedNow && <div className="mt-0.5 text-muted-foreground">{fmt(t.escalate, { date: dateStr(new Date(due.getTime() + DAY).toISOString(), lang) })}</div>}
          </div>
        </div>
      )}

      <details className="group border-t px-4 py-2.5 text-xs text-muted-foreground">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 hover:text-foreground">
          <Info className="size-3.5" /> {t.how}
        </summary>
        <p className="mt-2 leading-relaxed text-pretty">{fmt(t.howText, { rows, pct, cover })}</p>
      </details>
    </section>
  );
}
