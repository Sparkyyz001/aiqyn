import { CheckCircle2, Clock, Hourglass, AlertTriangle } from "lucide-react";
import { fmt, type Dict } from "@/lib/i18n/dict";

const d = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Aqtau" });

// Блок «Как решили»: что сделано, кем, когда, за сколько дней и уложились ли в срок по закону
export function Outcome({
  status, createdAt, resolvedAt, slaDueAt, resolution, serviceName, t,
}: {
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  slaDueAt: string | null;
  resolution: string | null;
  serviceName: string | null;
  t: Dict["outcome"];
}) {
  const resolved = status === "resolved" && resolvedAt;
  const days = resolved ? Math.max(1, Math.round((new Date(resolvedAt).getTime() - new Date(createdAt).getTime()) / 86400_000)) : null;
  const inTime = resolved && slaDueAt ? new Date(resolvedAt) <= new Date(slaDueAt) : null;

  const head = resolved ? (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[color:var(--ok)]" />
      <div>
        <div className="font-medium">
          {fmt(t.resolvedOn, { d: d(resolvedAt) })} · {fmt(t.took, { n: days! })}
        </div>
        {inTime != null && (
          <div className={`text-sm ${inTime ? "text-[color:var(--ok)]" : "text-[color:var(--danger)]"}`}>
            {inTime ? t.inTime : t.late}
            {slaDueAt && <span className="text-muted-foreground"> · {fmt(t.dueWas, { d: d(slaDueAt) })}</span>}
          </div>
        )}
      </div>
    </div>
  ) : status === "awaiting_confirmation" ? (
    <div className="flex items-center gap-2 text-[color:var(--warn)]">
      <Hourglass className="size-5" /> <span className="font-medium">{t.awaiting}</span>
    </div>
  ) : status === "rejected" ? (
    <div className="flex items-center gap-2 text-muted-foreground">
      <AlertTriangle className="size-5" /> <span className="font-medium">{t.tlRejected}</span>
    </div>
  ) : (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Clock className="size-5" /> <span className="font-medium">{["accepted", "in_progress", "reopened"].includes(status) ? t.inWork : t.notYet}</span>
    </div>
  );

  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 font-medium">{t.title}</h2>
      {head}
      {(resolution || serviceName) && (resolved || status === "awaiting_confirmation") && (
        <dl className="mt-3 grid gap-2 border-t pt-3 text-sm">
          {serviceName && (
            <div>
              <dt className="text-xs text-muted-foreground">{t.who}</dt>
              <dd>{serviceName}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">{t.what}</dt>
            <dd>{resolution ?? <span className="text-muted-foreground">{t.noReply}</span>}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
