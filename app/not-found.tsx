import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDict } from "@/lib/i18n/server";

export default async function NotFound() {
  const { lang } = await getDict();
  const kz = lang === "kz";
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <MapPinOff className="size-7" />
      </span>
      <h1 className="text-xl font-semibold">{kz ? "Бет табылмады" : "Страница не найдена"}</h1>
      <p className="text-sm text-muted-foreground text-pretty">
        {kz ? "Сілтеме қате болуы мүмкін немесе өтініш жойылған." : "Возможно, ссылка набрана с ошибкой или обращение было удалено."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/map">{kz ? "Өтініштер картасы" : "Карта обращений"}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{kz ? "Басты бет" : "На главную"}</Link>
        </Button>
      </div>
    </div>
  );
}
