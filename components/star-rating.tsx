"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { rateService } from "@/lib/actions/services";
import { cn } from "@/lib/utils";

// Оценка службы: средний балл с дробным заполнением звёзд, при наведении — «волна» подсветки,
// клик — своя оценка (можно поменять). Для гостя — только просмотр.
export function StarRating({ code, avg, count, mine, canRate, l }: { code: string; avg: number; count: number; mine: number | null; canRate: boolean; l: { rate: string; yours: string; votes: string; login: string; thanks: string } }) {
  const [state, setState] = useState({ avg, count, mine });
  const [hover, setHover] = useState<number | null>(null);
  const [pop, setPop] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const shown = hover ?? state.mine ?? state.avg;

  const rate = (n: number) =>
    start(async () => {
      setPop(n);
      setTimeout(() => setPop(null), 450);
      const prev = state;
      setState((s) => ({ ...s, mine: n }));
      const r = await rateService(code, n);
      if (!r.ok) {
        setState(prev);
        return void toast.error(r.error);
      }
      setState({ avg: r.data.avg, count: r.data.count, mine: n });
      toast.success(l.thanks);
    });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(null)} role={canRate ? "radiogroup" : undefined} aria-label={l.rate}>
          {[1, 2, 3, 4, 5].map((i) => {
            const fill = Math.max(0, Math.min(1, shown - (i - 1)));
            return (
              <button
                key={i}
                type="button"
                disabled={!canRate || pending}
                onMouseEnter={() => canRate && setHover(i)}
                onFocus={() => canRate && setHover(i)}
                onClick={() => rate(i)}
                aria-label={`${i}`}
                className={cn(
                  "relative p-0.5 transition-transform duration-200 ease-out disabled:cursor-default",
                  canRate && "hover:scale-125 focus-visible:scale-125",
                  pop != null && i <= pop && "animate-[star-pop_0.45s_ease-out]"
                )}
                style={pop != null ? { animationDelay: `${(i - 1) * 50}ms` } : undefined}
              >
                <Star className="size-5 text-muted-foreground/30" strokeWidth={1.5} />
                <span className="absolute inset-0.5 overflow-hidden transition-[width] duration-300" style={{ width: `${fill * 100}%` }}>
                  <Star className="size-5 fill-[#f5b301] text-[#f5b301]" strokeWidth={1.5} />
                </span>
              </button>
            );
          })}
        </div>
        <span className="text-sm font-semibold tabular-nums">{state.avg.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {state.count} {l.votes}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{canRate ? (state.mine ? `${l.yours}: ${state.mine}★` : l.rate) : l.login}</span>
    </div>
  );
}
