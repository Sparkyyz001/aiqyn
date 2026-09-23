import Link from "next/link";
import { Users, RotateCcw, ShieldAlert } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { SlaTimer } from "@/components/reports/sla-timer";
import { CATEGORY, DISTRICT, nm } from "@/lib/meta";
import type { Dict, Lang } from "@/lib/i18n/dict";

export type RowReport = {
  id: number;
  public_no: string;
  title: string;
  status: string;
  category: string;
  district: string | null;
  sla_due_at: string | null;
  confirmations_count: number;
  reopen_count: number;
  priority_score: number;
  created_at: string;
  photo_unverified?: boolean;
};

export function ReportRow({ r, lang, t, showPriority = true }: { r: RowReport; lang: Lang; t: Pick<Dict, "status" | "card">; showPriority?: boolean }) {
  const closed = r.status === "resolved" || r.status === "rejected";
  return (
    <Link href={`/report/${r.public_no}`} className="flex flex-col gap-1.5 px-4 py-3 hover:bg-accent/50 sm:flex-row sm:items-center sm:gap-4">
      {showPriority && (
        <div className="hidden w-12 shrink-0 text-right text-lg font-semibold tabular-nums sm:block" title={t.card.priority}>
          {Math.round(r.priority_score)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 font-medium">{r.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{r.public_no}</span>
          <span>{nm(CATEGORY[r.category], lang)}</span>
          {r.district && <span>{nm(DISTRICT[r.district], lang)}</span>}
          {r.confirmations_count > 0 && (
            <span className="inline-flex items-center gap-0.5"><Users className="size-3" />{r.confirmations_count}</span>
          )}
          {r.reopen_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[color:var(--danger)]"><RotateCcw className="size-3" />{r.reopen_count}</span>
          )}
          {r.photo_unverified && <ShieldAlert className="size-3 text-[color:var(--warn)]" />}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showPriority && <span className="text-xs text-muted-foreground tabular-nums sm:hidden">P {Math.round(r.priority_score)}</span>}
        <SlaTimer dueAt={r.sla_due_at} closed={closed} t={t.card} compact />
        <StatusBadge status={r.status} label={t.status[r.status as keyof Dict["status"]]} />
      </div>
    </Link>
  );
}
