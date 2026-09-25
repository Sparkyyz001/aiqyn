"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Лендинг и вход — с обычной шапкой и подвалом; всё остальное приложение —
// с боковым меню слева и контентом в скруглённой карточке (как в консолях управления).
const BARE = (p: string) => p === "/" || p.startsWith("/login") || p.startsWith("/auth");

export function ShellSwitch({
  header,
  footer,
  sidebar,
  tools,
  titles,
  bottom,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  sidebar: React.ReactNode;
  tools: React.ReactNode;
  titles: [string, string][];
  bottom?: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();

  if (BARE(path)) {
    return (
      <>
        {header}
        <main className="flex flex-1 flex-col">{children}</main>
        {footer}
      </>
    );
  }

  // Заголовок страницы — по самому длинному совпавшему префиксу пути
  const title = titles.filter(([p]) => path === p || path.startsWith(p + "/")).sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "AIQYN";

  return (
    <SidebarProvider style={{ "--sidebar-width": "16.5rem" } as React.CSSProperties}>
      {sidebar}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-[1000] flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/90 px-3 backdrop-blur md:px-5">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
          <h1 className="truncate text-sm font-medium md:text-base">{title}</h1>
          <div className="ml-auto flex items-center gap-1">{tools}</div>
        </header>
        {/* снизу место под панель вкладок на телефоне */}
        <main className="flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      </SidebarInset>
      {bottom}
    </SidebarProvider>
  );
}
