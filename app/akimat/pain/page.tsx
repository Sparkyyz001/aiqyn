import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dict";
import { painData } from "@/lib/pain-data";
import { DISTRICT, nm } from "@/lib/meta";
import { CityMap } from "@/components/map/map";
import { PainLegend, PainRanking } from "@/components/akimat/pain-parts";
import type { GeoPolygon } from "@/lib/geo";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.pain.short };
}

export default async function PainPage() {
  const [{ lang, t }, { rows, delta, ref }] = await Promise.all([getDict(), painData()]);
  const polyBy = new Map(ref.districts.map((d) => [d.code, d.polygon as GeoPolygon | null]));
  const insufficient = rows.filter((r) => r.insufficient).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{t.pain.title}</h1>
        <p className="mt-1 max-w-3xl text-sm font-medium">{t.pain.pitch}</p>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t.pain.formula}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="overflow-hidden rounded-lg border">
          <div className="border-b px-4 py-2.5">
            <PainLegend t={t.pain} />
          </div>
          <CityMap
            className="h-[420px] w-full lg:h-[600px]"
            choropleth={rows
              .filter((r) => polyBy.get(r.district))
              .map((r) => ({
                geojson: polyBy.get(r.district) as unknown as GeoJSON.GeoJsonObject,
                index: r.index,
                label: `${nm(DISTRICT[r.district], lang)} · ${r.index ?? t.pain.insufficient}`,
                href: `/akimat/pain/${r.district}`,
              }))}
          />
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t.pain.top}</h2>
          <PainRanking rows={rows} delta={delta} lang={lang} t={t.pain} />
          <p className="text-xs text-muted-foreground">{fmt(t.pain.insufficientNote, { n: insufficient })}</p>
          <p className="text-xs text-muted-foreground">{t.pain.changeHint}</p>
          <p className="text-xs text-muted-foreground">{t.pain.notActivity}</p>
        </section>
      </div>
    </div>
  );
}
