import { Award, Info, TrendingDown, TrendingUp } from "lucide-react";
import { fmt, type Dict } from "@/lib/i18n/dict";
import { LEVELS, levelOf, voteWeight } from "@/lib/reputation";

type T = Dict["me"]["rep"];
export type RepEvent = { id: number; delta: number; reason: string; created_at: string; meta: { no?: string } | null };

// «Мой вклад в город»: уровень доверия (ADDON_3), вес голоса и понятная история начислений.
// Не рейтинг и не игра на очки: уровень объясняет, почему голос жителя весит столько, сколько весит.
export function Contribution({ rep, createdAt, events, impact, t }: { rep: number; createdAt: string | null; events: RepEvent[]; impact: [number, number, number]; t: T }) {
  const lvl = levelOf(rep);
  const w = voteWeight(rep, createdAt);
  const d = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Asia/Aqtau" });
  return (
    <section className="mt-6 overflow-hidden rounded-3xl border bg-card">
      <div className="grid gap-6 p-5 md:grid-cols-[1.1fr_1fr] md:p-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Award className="size-4 text-primary" /> {t.title}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
            <span className="text-2xl font-semibold tracking-tight">{t.levels[lvl.key]}</span>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">{fmt(t.weight, { w: `×${w.toString().replace(".", ",")}` })}</span>
          </div>

          {/* ступени уровней */}
          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {LEVELS.map((l, i) => (
              <div key={l.key}>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full origin-left rounded-full bg-gradient-to-r from-[#0b6b63] to-[#76cf6a] transition-transform duration-1000"
                    style={{ transform: `scaleX(${i < lvl.index ? 1 : i === lvl.index ? Math.max(0.08, lvl.progress) : 0})` }}
                  />
                </div>
                <div className={`mt-1 text-[11px] ${i === lvl.index ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{t.levels[l.key]}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {lvl.next ? fmt(t.toNext, { l: t.levels[lvl.next], n: lvl.toNext.toFixed(1).replace(".", ",") }) : t.top}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {t.impact.map(([big, small], i) => (
              <div key={big} className="rounded-2xl bg-muted/50 px-3 py-2.5">
                <div className="font-serif text-2xl leading-none tabular-nums">{impact[i]}</div>
                <div className="mt-1 text-[11px] leading-tight text-muted-foreground">
                  {big} {small}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 flex gap-2 text-xs text-muted-foreground text-pretty">
            <Info className="mt-0.5 size-3.5 shrink-0" /> {t.weightHint}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="text-sm font-semibold">{t.history}</div>
            {events.length ? (
              <ul className="mt-2 flex flex-col divide-y rounded-2xl border">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                    <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${e.delta >= 0 ? "bg-[color:var(--ok)]/15 text-[color:var(--ok)]" : "bg-[color:var(--danger)]/12 text-[color:var(--danger)]"}`}>
                      {e.delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1 text-pretty">{fmt(t.reasons[e.reason as keyof T["reasons"]] ?? e.reason, { no: e.meta?.no ?? "" })}</span>
                    <span className={`shrink-0 font-semibold tabular-nums ${e.delta >= 0 ? "text-[color:var(--ok)]" : "text-[color:var(--danger)]"}`}>
                      {e.delta > 0 ? "+" : ""}
                      {e.delta.toString().replace(".", ",")}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{d(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">{t.empty}</p>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold">{t.how}</div>
            <ul className="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
              {t.howList.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
