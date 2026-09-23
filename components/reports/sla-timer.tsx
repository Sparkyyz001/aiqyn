"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { slaState } from "@/lib/sla";
import { cn } from "@/lib/utils";
import type { Dict } from "@/lib/i18n/dict";

// Публичный SLA-таймер: рабочие дни до срока / на сколько просрочено, обновляется каждую минуту.
export function SlaTimer({ dueAt, closed, t, compact = false }: { dueAt: string | null; closed: boolean; t: Dict["card"]; compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const due = dueAt ? new Date(dueAt) : null;
  const s = slaState(due, now, closed);
  const hours = Math.floor(Math.abs(s.msLeft) / 3600_000);
  const dueStr = due?.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Aqtau" });

  const tone = {
    ok: "border-[color:var(--ok)]/40 bg-ok/5 text-[color:var(--ok)]",
    warn: "border-[color:var(--warn)]/50 bg-warn/10 text-[color:var(--warn)]",
    danger: "border-[color:var(--danger)]/50 bg-danger/10 text-[color:var(--danger)]",
    done: "border-border bg-muted/40 text-muted-foreground",
  }[s.level];

  const Icon = s.level === "danger" ? AlertTriangle : s.level === "done" ? CheckCircle2 : Clock;
  const main =
    s.level === "done"
      ? t.done
      : s.breached
        ? `${t.overdue} ${Math.max(1, Math.abs(s.workingDaysLeft))} ${t.wd}`
        : s.workingDaysLeft > 0
          ? `${t.left} ${s.workingDaysLeft} ${t.wd}`
          : `${t.left} ${hours} ч`;

  if (compact)
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums", tone)}>
        <Icon className="size-3" /> {s.breached && s.level !== "done" ? t.breached : main}
      </span>
    );

  return (
    <div className={cn("rounded-lg border p-3", tone)}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase opacity-80">{t.sla}</div>
      <div className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums">
        <Icon className="size-5" /> {main}
      </div>
      {s.breached && s.level !== "done" && <div className="mt-1 text-sm font-bold tracking-wide">{t.breached}</div>}
      {dueStr && (
        <div className="mt-1 text-xs text-muted-foreground">
          {t.dueAt} {dueStr}
        </div>
      )}
    </div>
  );
}
