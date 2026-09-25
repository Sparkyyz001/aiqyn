import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dict";
import { painData, painChoropleth } from "@/lib/pain-data";
import { DISTRICT, nm } from "@/lib/meta";
import { CityMap } from "@/components/map/map";
import { PainLegend, PainRanking } from "@/components/akimat/pain-parts";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.pain.short };
}

export default async function PainPage() {
  const [{ lang, t }, { rows, delta, polygons }] = await Promise.all([getDict(), painData()]);
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
            choropleth={painChoropleth(rows, polygons, (r) => `${nm(DISTRICT[r.district], lang)} · ${r.index ?? t.pain.insufficient}`)}
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
