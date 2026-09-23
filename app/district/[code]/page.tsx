import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dict";
import { painData } from "@/lib/pain-data";
import { painHistory } from "@/lib/pain-index";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY, DISTRICT, nm, addressLabel } from "@/lib/meta";
import { CityMap } from "@/components/map/map";
import { PainDelta, PainSwatch } from "@/components/akimat/pain-parts";
import { PainHistoryChart } from "@/components/akimat/pain-history-chart";

export async function generateMetadata({ params }: PageProps<"/district/[code]">) {
  const { code } = await params;
  const { lang, t } = await getDict();
  return { title: `${nm(DISTRICT[code], lang)} · ${t.pain.short}` };
}

export default async function PainDistrictPage({ params }: PageProps<"/district/[code]">) {
  const { code } = await params;
  const [{ lang, t }, { all, rows, delta, clusters, chronicBy, ref }] = await Promise.all([getDict(), painData()]);
  const row = rows.find((r) => r.district === code);
  const district = ref.districts.find((d) => d.code === code);
  if (!row || !district) notFound();

  // Динамика: из ежедневных снимков; если их ещё нет — восстанавливаем из потока
  const { data: hist } = await createAdminClient()
    .from("pain_index_history")
    .select("computed_at, breakdown")
    .eq("district_id", district.id)
    .gte("computed_at", new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10))
    .order("computed_at");
  // Единая шкала для всей истории: 100 = худший район города сегодня (см. комментарий в painHistory)
  const maxRaw = Math.max(1, ...rows.map((x) => x.raw ?? 0));
  const rawHistory =
    hist && hist.length >= 10
      ? hist.map((h) => ({ date: h.computed_at as string, raw: ((h.breakdown as { raw?: number | null } | null)?.raw ?? null) as number | null }))
      : painHistory(all, ref.districts.filter((d) => d.kind !== "zone").map((d) => ({ code: d.code, population: d.population })), code);
  const history = rawHistory.map((h) => ({ date: h.date, index: h.raw == null ? null : Math.round((h.raw / maxRaw) * 100) }));

  const points = clusters.filter((c) => c.district === code);
  const p = t.pain;
  const d30 = delta(code);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <Link href="/map" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.nav.map}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">{p.short}</div>
          <h1 className="text-2xl font-semibold">{nm(DISTRICT[code], lang)}</h1>
        </div>
        {row.insufficient ? (
          <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{p.insufficient}</div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
            <PainSwatch index={row.index} className="size-8" />
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                {row.index} <span className="text-base font-normal text-muted-foreground">{p.of100}</span>
              </div>
              <div className="text-xs">
                {p.change}: <PainDelta d={d30} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="font-medium">{p.breakdown}</h2>
          {row.breakdown.length ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {row.breakdown.map((b) => (
                <li key={b.group} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                  <span>{p.groups[b.group]}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.insufficient ? "" : `${b.value} · `}
                    {Math.round(b.share * 100)}%
                  </span>
                  <span className="col-span-2 h-2 overflow-hidden rounded-sm bg-muted">
                    <span className="block h-full bg-[var(--series-1)]" style={{ width: `${b.share * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">—</p>
          )}
          {row.raw != null && <p className="mt-3 text-xs text-muted-foreground">{fmt(p.perK, { n: Math.round(row.raw) })}</p>}
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="font-medium">{p.pullsUp}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>{fmt(p.chronic, { n: chronicBy.get(code) ?? 0 })}</li>
            <li className={row.breached ? "text-[color:var(--danger)]" : ""}>{fmt(p.breachedN, { n: row.breached })}</li>
            <li>{fmt(p.reopenedN, { n: row.reopened })}</li>
            <li className="text-muted-foreground">{fmt(p.openN, { n: row.open })}</li>
          </ul>
          <div className="mt-4 border-t pt-3 text-sm">
            <div className="text-xs text-muted-foreground">{p.population}</div>
            <div className="font-medium tabular-nums">{row.population ? new Intl.NumberFormat("ru-RU").format(row.population) : "—"}</div>
            <p className="mt-1 text-xs text-muted-foreground">{p.popNote}</p>
          </div>
        </section>
      </div>

      <section className="rounded-lg border p-4">
        <h2 className="font-medium">{p.history}</h2>
        <p className="mb-2 text-xs text-muted-foreground">{p.changeHint}</p>
        <PainHistoryChart data={history} label={p.index} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border">
          <CityMap
            className="h-[320px] w-full"
            center={{ lat: district.center_lat, lng: district.center_lng }}
            zoom={15}
            choropleth={district.polygon ? [{ geojson: district.polygon as unknown as GeoJSON.GeoJsonObject, index: row.index, label: nm(DISTRICT[code], lang) }] : []}
            circles={points.map((c) => ({ lat: c.lat, lng: c.lng, radius: Math.max(50, c.radius_m), color: "#1b2330", label: `${addressLabel(c.label, lang) ?? ""} · ${nm(CATEGORY[c.category], lang)} · ${c.count}` }))}
          />
        </section>
        <section className="rounded-lg border">
          <h2 className="border-b px-4 py-2.5 font-medium">{p.points}</h2>
          {points.length ? (
            <ul className="divide-y text-sm">
              {points.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <div className="font-medium">{addressLabel(c.label, lang) ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{nm(CATEGORY[c.category], lang)} · {c.count}</div>
                  </div>
                  <span className="shrink-0 tabular-nums">{c.chronic_score.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">{p.noPoints}</p>
          )}
        </section>
      </div>
    </div>
  );
}
