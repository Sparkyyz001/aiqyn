import { MapPin, Users, RotateCcw } from "lucide-react";
import { HonestDeadline } from "@/components/reports/honest-deadline";
import { ShareButton } from "@/components/reports/share-button";
import type { HonestForecast } from "@/lib/honest-deadline";
import { SlaTimer } from "@/components/reports/sla-timer";
import { StatusBadge } from "@/components/status-badge";
import { CityMap } from "@/components/map/map";
import { Outcome } from "@/components/reports/outcome";
import { demoDetails } from "@/lib/demo-details";
import { titleOf } from "@/lib/data";
import { CATEGORY, DISTRICT, SERVICE, nm } from "@/lib/meta";
import { fmt, type Dict, type Lang } from "@/lib/i18n/dict";
import type { BaseReport } from "@/lib/demo-baseline";

const dt = (s: string) =>
  new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Aqtau" });
const plus = (s: string, minutes: number) => new Date(new Date(s).getTime() + minutes * 60_000).toISOString();

// Карточка демо-обращения: те же блоки, что у реального, но только для чтения и с явной пометкой
export function DemoCard({ r, lang, t, honest }: { r: BaseReport; lang: Lang; t: Dict; honest: HonestForecast }) {
  const o = t.outcome;
  const svc = SERVICE[r.service];
  const { description, resolution } = demoDetails(r, lang);
  const closed = r.status === "resolved" || r.status === "rejected";

  // Хронология восстанавливается из дат записи
  const events: { at: string; text: string; tone?: "ok" | "danger" }[] = [
    { at: r.created_at, text: o.tlCreated },
    { at: plus(r.created_at, 2), text: fmt(o.tlRouted, { s: nm(svc, lang) }) },
  ];
  if (r.accepted_at) events.push({ at: r.accepted_at, text: o.tlAccepted });
  if (r.reopen_count > 0 && r.accepted_at) {
    const mid = new Date((new Date(r.accepted_at).getTime() + new Date(r.resolved_at ?? Date.now()).getTime()) / 2).toISOString();
    events.push({ at: mid, text: o.tlDone }, { at: plus(mid, 60 * 20), text: o.tlReopened, tone: "danger" });
  }
  if (r.status === "awaiting_confirmation" && r.accepted_at) events.push({ at: plus(r.accepted_at, 60 * 24 * 3), text: o.tlDone });
  if (r.status === "resolved" && r.resolved_at) events.push({ at: plus(r.resolved_at, -60 * 30), text: o.tlDone }, { at: r.resolved_at, text: o.tlConfirmed, tone: "ok" });
  if (r.status === "rejected") events.push({ at: plus(r.created_at, 60 * 24), text: o.tlRejected });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="font-mono">{r.public_no}</span>
        <span>·</span>
        <span>{nm(CATEGORY[r.category], lang)}</span>
        {r.district && (
          <>
            <span>·</span>
            <span>{nm(DISTRICT[r.district], lang)}</span>
          </>
        )}
        <span>·</span>
        <span>{dt(r.created_at)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{titleOf(r, lang)}</h1>
        <StatusBadge status={r.status} label={t.status[r.status as keyof Dict["status"]]} className="text-sm" />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <p className="text-pretty">{description}</p>

          {!closed && <HonestDeadline f={honest} dueAt={r.sla_due_at} t={t.honest} lang={lang} />}
          <ShareButton no={r.public_no} lang={lang} t={t.share} />

          <Outcome status={r.status} createdAt={r.created_at} resolvedAt={r.resolved_at} slaDueAt={r.sla_due_at} resolution={resolution} serviceName={nm(svc, lang)} t={o} />

          <section>
            <h2 className="mb-2 font-medium">{t.card.timeline}</h2>
            <ol className="relative ml-2 border-l pl-5">
              {events.map((e, i) => (
                <li key={i} className="mb-4 last:mb-0">
                  <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
                  <div className="text-xs text-muted-foreground tabular-nums">{dt(e.at)}</div>
                  <div className={`text-sm ${e.tone === "ok" ? "text-[color:var(--ok)]" : e.tone === "danger" ? "text-[color:var(--danger)]" : ""}`}>{e.text}</div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <SlaTimer dueAt={r.sla_due_at} closed={closed} t={t.card} />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums"><Users className="size-5 text-muted-foreground" />{r.confirmations}</div>
              <div className="text-xs text-muted-foreground">{t.card.confirmations}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className={`flex items-center gap-1.5 text-2xl font-semibold tabular-nums ${r.reopen_count ? "text-[color:var(--danger)]" : ""}`}><RotateCcw className="size-5 text-muted-foreground" />{r.reopen_count}</div>
              <div className="text-xs text-muted-foreground">{t.card.reopened}, {t.card.times}</div>
            </div>
          </div>
          {svc && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="text-xs text-muted-foreground">{t.card.service}</div>
              <div className="font-medium">{nm(svc, lang)}</div>
            </div>
          )}
          <div className="overflow-hidden rounded-lg border">
            <CityMap className="h-52 w-full" center={{ lat: r.lat, lng: r.lng }} zoom={16} picked={{ lat: r.lat, lng: r.lng }} />
            <div className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground">
              <MapPin className="size-3" /> {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
