import Link from "next/link";
import { AlarmClock, ArrowRight, Inbox, Users } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dict";
import { painData, painChoropleth } from "@/lib/pain-data";
import { painColor } from "@/lib/pain-index";
import { DISTRICT, nm } from "@/lib/meta";
import { CityMap } from "@/components/map/map";
import { PainLegend } from "@/components/akimat/pain-parts";
import { LiveRefresh } from "@/components/live-refresh";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.pain.districtsTitle };
}

// Районы Актау: карта города, раскрашенная по индексу боли, и карточки микрорайонов —
// житель находит свой район и сразу видит, насколько там тяжело и что тянет индекс вверх.
export default async function DistrictsPage() {
  const [{ lang, t }, { rows, delta, polygons }] = await Promise.all([getDict(), painData()]);
  const ranked = rows.filter((r) => !r.insufficient && DISTRICT[r.district]);
  const n = new Intl.NumberFormat("ru-RU");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <LiveRefresh />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.pain.districtsTitle}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{t.pain.pitch}</p>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <CityMap
          className="h-[380px] w-full md:h-[480px]"
          choropleth={painChoropleth(rows, polygons, (r) => `${nm(DISTRICT[r.district], lang)} · ${r.index ?? t.pain.insufficient}`)}
        />
        <div className="border-t px-4 py-2.5">
          <PainLegend t={t.pain} />
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ranked.map((r, i) => {
          const d = delta(r.district);
          const color = painColor(r.index, false);
          return (
            <li key={r.district}>
              <Link
                href={`/district/${r.district}`}
                className="group flex h-full flex-col rounded-2xl border bg-card p-4 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_28px_-14px_rgb(5_62_66/0.45)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground tabular-nums">#{i + 1}</div>
                    <div className="text-lg font-semibold leading-tight">{nm(DISTRICT[r.district], lang)}</div>
                  </div>
                  {/* круговая шкала индекса */}
                  <div className="relative grid size-14 shrink-0 place-items-center">
                    <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--muted)" strokeWidth="3.5" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${((r.index ?? 0) / 100) * 97.4} 97.4`} />
                    </svg>
                    <span className="text-sm font-bold tabular-nums">{r.index}</span>
                  </div>
                </div>
                {d != null && d !== 0 && (
                  <div className={`mt-1 text-xs font-medium tabular-nums ${d > 0 ? "text-[color:var(--danger)]" : "text-[color:var(--ok)]"}`}>
                    {d > 0 ? "↑" : "↓"} {d > 0 ? "+" : ""}
                    {d}% · {t.pain.d30}
                  </div>
                )}
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
                  <div>
                    <dt className="flex items-center justify-center gap-1 text-base font-semibold tabular-nums"><Inbox className="size-3.5 text-muted-foreground" />{r.open}</dt>
                    <dd className="text-muted-foreground">{t.pain.openShort}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center justify-center gap-1 text-base font-semibold tabular-nums text-[color:var(--danger)]"><AlarmClock className="size-3.5" />{r.breached}</dt>
                    <dd className="text-muted-foreground">{t.pain.breached}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center justify-center gap-1 text-base font-semibold tabular-nums"><Users className="size-3.5 text-muted-foreground" />{r.population ? n.format(r.population) : "—"}</dt>
                    <dd className="text-muted-foreground">{t.pain.residents}</dd>
                  </div>
                </dl>
                {r.breakdown.length > 0 && (
                  <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted" title={r.breakdown.map((b) => `${t.pain.groups[b.group]}: ${Math.round(b.share * 100)}%`).join(", ")}>
                    {r.breakdown.map((b, j) => (
                      <span key={b.group} className="h-full" style={{ width: `${b.share * 100}%`, background: ["#b8502f", "#d97c58", "#e39a7a", "#8a9aa8", "#c3ccd4"][j % 5] }} />
                    ))}
                  </div>
                )}
                {r.breakdown[0] && <div className="mt-1.5 text-xs text-muted-foreground">{fmt(t.pain.mainDriver, { g: t.pain.groups[r.breakdown[0].group] })}</div>}
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-primary">
                  {t.pain.openDistrict} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{fmt(t.pain.insufficientNote, { n: rows.length - ranked.length })}</p>
    </div>
  );
}
