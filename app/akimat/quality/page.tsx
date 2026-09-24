import { AlarmClock, Camera, MessageSquareWarning, RotateCcw, Star } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { fmt as tf } from "@/lib/i18n/dict";
import { flow } from "@/lib/data";
import { serviceQuality } from "@/lib/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { boilerplateScore, BOILERPLATE_THRESHOLD } from "@/lib/boilerplate";
import { SERVICE, nm } from "@/lib/meta";
import { Kpi } from "@/components/kpi";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.akimat.nav.quality };
}

// Индекс качества службы: 100 минус взвешенные штрафы (доли в процентах)
const qualityScore = (r: { breachedShare: number; reopenShare: number; boilerShare: number; unverifiedPhotoShare: number }) =>
  Math.max(0, Math.round(100 - (0.35 * r.breachedShare + 0.25 * r.reopenShare + 0.25 * r.boilerShare + 0.15 * r.unverifiedPhotoShare)));
const tone = (s: number) => (s >= 85 ? "good" : s >= 75 ? "mid" : "bad");
const TONE = {
  good: "text-[color:var(--ok)] border-[color:var(--ok)]/35 bg-[color:var(--ok)]/[0.06]",
  mid: "text-[color:var(--warn)] border-[color:var(--warn)]/40 bg-[color:var(--warn)]/[0.07]",
  bad: "text-[color:var(--danger)] border-[color:var(--danger)]/35 bg-[color:var(--danger)]/[0.06]",
} as const;

export default async function QualityPage() {
  const [{ lang, t }, { all }, ref] = await Promise.all([getDict(), flow(), getReference()]);
  const q = t.akimat.quality;
  const rows = serviceQuality(all)
    .map((r) => ({ ...r, score: qualityScore(r) }))
    .sort((a, b) => b.score - a.score);
  const db = createAdminClient();
  const [{ data: replies }, { data: ratings }] = await Promise.all([
    db.from("service_replies").select("id, text, boilerplate_score, service_id, created_at").order("boilerplate_score", { ascending: false }).limit(6),
    db.from("service_ratings").select("service_id, stars"),
  ]);
  const stars = new Map<string, { sum: number; n: number }>();
  for (const r of ratings ?? []) {
    const code = ref.serviceById.get(r.service_id)?.code;
    if (!code) continue;
    const a = stars.get(code) ?? { sum: 0, n: 0 };
    a.sum += r.stars;
    a.n++;
    stars.set(code, a);
  }
  // средние по городу, взвешенные числом обращений
  const tot = rows.reduce((s, r) => s + r.total, 0) || 1;
  const avg = (k: "breachedShare" | "reopenShare" | "boilerShare" | "unverifiedPhotoShare") => (rows.reduce((s, r) => s + r[k] * r.total, 0) / tot).toFixed(1);

  const metrics = (r: (typeof rows)[number]) => [
    { label: q.breached, v: r.breachedShare, color: "var(--danger)" },
    { label: q.reopened, v: r.reopenShare, color: "var(--warn)" },
    { label: q.boiler, v: r.boilerShare, color: "#8a63d2" },
    { label: q.unverified, v: r.unverifiedPhotoShare, color: "#5aa9e6" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{q.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{tf(q.intro, { p: Math.round(BOILERPLATE_THRESHOLD * 100) })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={q.avgBreached} value={`${avg("breachedShare")}%`} tone="danger" icon={<AlarmClock />} />
        <Kpi label={q.avgReopened} value={`${avg("reopenShare")}%`} tone="warn" icon={<RotateCcw />} />
        <Kpi label={q.avgBoiler} value={`${avg("boilerShare")}%`} icon={<MessageSquareWarning />} />
        <Kpi label={q.avgUnverified} value={`${avg("unverifiedPhotoShare")}%`} icon={<Camera />} />
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">{q.ranking}</h2>
          <p className="max-w-3xl text-xs text-muted-foreground text-pretty">{q.scoreNote}</p>
        </div>
        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r, i) => {
            const g = tone(r.score);
            const st = stars.get(r.service);
            return (
              <li key={r.service} className="flex flex-col rounded-2xl border bg-card p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgb(5_62_66/0.45)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground tabular-nums">#{i + 1}</div>
                    <div className="font-semibold">{SERVICE[r.service]?.short ?? r.service}</div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{nm(SERVICE[r.service], lang)}</div>
                  </div>
                  <div className={cn("flex shrink-0 flex-col items-center rounded-xl border px-3 py-1.5", TONE[g])}>
                    <span className="text-2xl font-bold tabular-nums">{r.score}</span>
                    <span className="text-[10px] font-medium whitespace-nowrap">{q.grade[g]}</span>
                  </div>
                </div>
                <ul className="mt-4 flex flex-col gap-2">
                  {metrics(r).map((m) => (
                    <li key={m.label}>
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{m.label}</span>
                        <span className="font-medium tabular-nums">{m.v}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, m.v)}%`, background: m.color }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
                  <div>
                    <div className="text-base font-semibold tabular-nums">{r.total}</div>
                    <div className="text-muted-foreground">{q.reports}</div>
                  </div>
                  <div>
                    <div className="text-base font-semibold tabular-nums">{r.medianDays}</div>
                    <div className="text-muted-foreground">{q.median}</div>
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1 text-base font-semibold tabular-nums">
                      <Star className="size-3.5 fill-[#f5b301] text-[#f5b301]" /> {st ? (st.sum / st.n).toFixed(1) : "—"}
                    </div>
                    <div className="text-muted-foreground">{q.people}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 className="font-semibold">{q.examples}</h2>
        {(replies ?? []).length ? (
          <ul className="mt-2 grid gap-3 md:grid-cols-2">
            {(replies ?? []).map((rep) => {
              const b = boilerplateScore(rep.text);
              return (
                <li key={rep.id} className="rounded-xl border bg-card p-4 text-sm">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{ref.serviceById.get(rep.service_id)?.short_name}</span>
                    <span className={`tabular-nums ${(rep.boilerplate_score ?? 0) >= BOILERPLATE_THRESHOLD ? "font-semibold text-[color:var(--warn)]" : ""}`}>{Math.round((rep.boilerplate_score ?? 0) * 100)}%</span>
                  </div>
                  <p className="mt-1.5 text-pretty">«{rep.text}»</p>
                  <div className="mt-2 flex flex-wrap gap-1 text-xs">
                    {b.markers.map((m) => <span key={m} className="rounded bg-warn/15 px-1.5 py-0.5">{m}</span>)}
                    {b.missing.map((m) => <span key={m} className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{q.missing[m]}</span>)}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{q.noReplies}</p>
        )}
      </section>
    </div>
  );
}
