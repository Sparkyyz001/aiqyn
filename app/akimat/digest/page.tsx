import { getDict } from "@/lib/i18n/server";
import { DigestViewer } from "./viewer";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.digest.nav };
}

// «Отчёт акиму» — документ на две страницы, который система собирает сама (ADDON_4)
export default async function DigestPage() {
  const { lang, t } = await getDict();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.digest.pageTitle}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{t.digest.pageSub}</p>
      </div>
      <DigestViewer t={t.digest} lang0={lang} />
    </div>
  );
}
