import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDict } from "@/lib/i18n/server";

// Временный лендинг — живые счётчики и карта появятся на этапе 2
export default async function Home() {
  const { t } = await getDict();
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 md:py-20">
      <p className="text-sm font-medium text-primary">AIQYN · Ақтау</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">
        {t.tagline}
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">
        В Актау проблема не в том, что жалобу некуда подать. Проблема в том, что после подачи ничего не видно
        и никто не отвечает по срокам. AIQYN превращает жалобу в отслеживаемое обязательство
        с юридическим сроком и доказательной базой.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/report/new">
            <Plus /> {t.nav.report}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/map">{t.nav.map}</Link>
        </Button>
      </div>
    </section>
  );
}
