import Link from "next/link";
import { getDict } from "@/lib/i18n/server";

export async function SiteFooter() {
  const { t } = await getDict();
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-xs text-muted-foreground">
        <span>AIQYN · {t.tagline}</span>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/map" className="hover:text-foreground">{t.nav.map}</Link>
          <Link href="/incidents" className="hover:text-foreground">{t.nav.incidents}</Link>
          <Link href="/open-data" className="hover:text-foreground">{t.nav.openData}</Link>
        </nav>
      </div>
    </footer>
  );
}
