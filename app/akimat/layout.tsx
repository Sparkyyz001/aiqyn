import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";

const NAV = [
  { href: "/akimat", key: "overview" },
  { href: "/akimat/clusters", key: "clusters" },
  { href: "/akimat/quality", key: "quality" },
  { href: "/akimat/money", key: "money" },
  { href: "/akimat/forecast", key: "forecast" },
  { href: "/akimat/air", key: "air" },
  { href: "/akimat/light", key: "light" },
] as const;

export default async function AkimatLayout({ children }: LayoutProps<"/akimat">) {
  await requireRole("akimat", "operator");
  const { t } = await getDict();
  return (
    <div className="flex flex-1 flex-col">
      <nav className="sticky top-14 z-[1000] border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="px-3 py-2.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground">
              {t.akimat.nav[n.key]}
            </Link>
          ))}
        </div>
      </nav>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      <p className="mx-auto w-full max-w-7xl px-4 pb-6 text-xs text-muted-foreground">
        {t.akimat.flowNote}
      </p>
    </div>
  );
}
