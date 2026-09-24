import { getDict } from "@/lib/i18n/server";
import { painData } from "@/lib/pain-data";
import { PainRanking } from "@/components/akimat/pain-parts";
import { LiveRefresh } from "@/components/live-refresh";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.pain.districtsTitle };
}

// Все районы города с индексом боли — житель находит свой микрорайон и видит, как там обстоят дела
export default async function DistrictsPage() {
  const [{ lang, t }, pain] = await Promise.all([getDict(), painData()]);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <LiveRefresh />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.pain.districtsTitle}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{t.pain.pitch}</p>
      </div>
      <PainRanking rows={pain.rows} delta={pain.delta} lang={lang} t={t.pain} />
    </div>
  );
}
