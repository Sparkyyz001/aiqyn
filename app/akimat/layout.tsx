import Link from "next/link";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/akimat", label: "Обзор" },
  { href: "/akimat/clusters", label: "Хронические точки" },
  { href: "/akimat/quality", label: "Качество служб" },
  { href: "/akimat/money", label: "Деньги и жалобы" },
  { href: "/akimat/forecast", label: "Прогноз дорог" },
  { href: "/akimat/air", label: "Источник запаха" },
  { href: "/akimat/light", label: "Тёмные зоны" },
];

export default async function AkimatLayout({ children }: LayoutProps<"/akimat">) {
  await requireRole("akimat", "operator");
  return (
    <div className="flex flex-1 flex-col">
      <nav className="sticky top-14 z-[1000] border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="px-3 py-2.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      <p className="mx-auto w-full max-w-7xl px-4 pb-6 text-xs text-muted-foreground">
        Аналитика считается по потоку: демо-подложка (синтетика на реальной географии, одинаковые вероятности для всех служб) +
        реальные обращения из базы. Различия между службами в демо-части — случайный шум, а не оценка организаций.
      </p>
    </div>
  );
}
