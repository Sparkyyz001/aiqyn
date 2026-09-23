import Link from "next/link";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { PAIN_RAMP_DARK, PAIN_RAMP_LIGHT, painColor, type PainRow } from "@/lib/pain-index";
import { DISTRICT, nm } from "@/lib/meta";
import type { Dict, Lang } from "@/lib/i18n/dict";

/** Изменение за 30 дней в % (баллы на 1000 жителей): рост — хуже (красный), падение — лучше (зелёный); значение всегда текстом */
export function PainDelta({ d }: { d: number | null }) {
  if (d == null) return <span className="text-muted-foreground">—</span>;
  if (d === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground tabular-nums">
        <Minus className="size-3" />0%
      </span>
    );
  return d > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-[color:var(--danger)] tabular-nums">
      <ArrowUp className="size-3" />+{d}%
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[color:var(--ok)] tabular-nums">
      <ArrowDown className="size-3" />
      {d}%
    </span>
  );
}

/** Квадрат цвета индекса: разная шкала для светлой и тёмной темы */
export function PainSwatch({ index, className = "size-3" }: { index: number | null; className?: string }) {
  return (
    <>
      <span className={`${className} shrink-0 rounded-sm dark:hidden`} style={{ background: painColor(index, false) }} />
      <span className={`${className} hidden shrink-0 rounded-sm dark:inline-block`} style={{ background: painColor(index, true) }} />
    </>
  );
}

export function PainLegend({ t }: { t: Dict["pain"] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        0
        <span className="flex dark:hidden">{PAIN_RAMP_LIGHT.map((c) => <span key={c} className="h-2.5 w-6" style={{ background: c }} />)}</span>
        <span className="hidden dark:flex">{PAIN_RAMP_DARK.map((c) => <span key={c} className="h-2.5 w-6" style={{ background: c }} />)}</span>
        100
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-4 bg-[#9aa3ad]/60" /> {t.insufficient}
      </span>
    </div>
  );
}

/** Рейтинг районов: индекс, изменение за 30 дней, обращения, просрочки */
export function PainRanking({
  rows, delta, lang, t, limit,
}: {
  rows: PainRow[];
  delta: (code: string) => number | null;
  lang: Lang;
  t: Dict["pain"];
  limit?: number;
}) {
  const list = rows.filter((r) => !r.insufficient).slice(0, limit ?? 999);
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-[1fr_3rem_4rem] gap-2 border-b px-4 py-2 text-xs text-muted-foreground sm:grid-cols-[1fr_3.5rem_5rem_6rem_5rem]">
        <span>{t.district}</span>
        <span className="text-right">{t.index}</span>
        <span className="text-right">{t.change}</span>
        <span className="hidden text-right sm:block">{t.reports}</span>
        <span className="hidden text-right sm:block">{t.breached}</span>
      </div>
      <ol className="divide-y">
        {list.map((r, i) => (
          <li key={r.district}>
            <Link
              href={`/akimat/pain/${r.district}`}
              className="grid grid-cols-[1fr_3rem_4rem] items-center gap-2 px-4 py-2 text-sm hover:bg-accent/50 sm:grid-cols-[1fr_3.5rem_5rem_6rem_5rem]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <PainSwatch index={r.index} />
                <span className="truncate">{nm(DISTRICT[r.district], lang)}</span>
              </span>
              <span className="text-right font-semibold tabular-nums">{r.index}</span>
              <span className="text-right text-xs">
                <PainDelta d={delta(r.district)} />
              </span>
              <span className="hidden text-right tabular-nums text-muted-foreground sm:block">{r.reports90}</span>
              <span className="hidden text-right tabular-nums text-muted-foreground sm:block">{r.breached}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
