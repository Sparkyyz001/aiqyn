"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, FileText, Headset, Inbox, LayoutDashboard, LogIn, Map as MapIcon, Menu, Plus, ShieldAlert, Wrench, Lightbulb } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

export type BottomLabels = { map: string; me: string; report: string; notifications: string; menu: string; login: string; initiatives: string; service: string; operator: string; overview: string; risk: string; digest: string };

type Tab = { href?: string; label: string; icon: typeof Bell; primary?: boolean; menu?: boolean };

// Нижняя панель вкладок на телефоне — как в приложениях: главные разделы роли в один тап,
// «Меню» открывает полное боковое меню. На компьютере скрыта (там боковое меню всегда видно).
export function BottomNav({ role, l, unread = 0 }: { role: Role | null; l: BottomLabels; unread?: number }) {
  const path = usePathname();
  const { setOpenMobile } = useSidebar();
  const menu: Tab = { label: l.menu, icon: Menu, menu: true };
  const bell: Tab = { href: "/notifications", label: l.notifications, icon: Bell };
  const tabs: Tab[] =
    role === "citizen"
      ? [{ href: "/map", label: l.map, icon: MapIcon }, { href: "/me", label: l.me, icon: Inbox }, { href: "/report/new", label: l.report, icon: Plus, primary: true }, bell, menu]
      : role === "service"
        ? [{ href: "/service", label: l.service, icon: Wrench }, { href: "/map", label: l.map, icon: MapIcon }, bell, menu]
        : role === "operator"
          ? [{ href: "/operator", label: l.operator, icon: Headset }, { href: "/service", label: l.service, icon: Wrench }, { href: "/akimat", label: l.overview, icon: LayoutDashboard }, bell, menu]
          : role === "akimat"
            ? [{ href: "/akimat", label: l.overview, icon: LayoutDashboard }, { href: "/akimat/risk", label: l.risk, icon: ShieldAlert }, { href: "/akimat/digest", label: l.digest, icon: FileText }, bell, menu]
            : [{ href: "/map", label: l.map, icon: MapIcon }, { href: "/initiatives", label: l.initiatives, icon: Lightbulb }, { href: "/report/new", label: l.report, icon: Plus, primary: true }, { href: "/login", label: l.login, icon: LogIn }, menu];

  const active = (href?: string) => !!href && (href === "/akimat" ? path === "/akimat" : path === href || path.startsWith(href + "/"));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[1150] border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label={l.menu}>
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = active(t.href);
          const body = t.primary ? (
            <span className="-mt-5 grid size-14 place-items-center rounded-full bg-[#ff907d] text-[#053e42] shadow-[0_10px_24px_-8px_rgb(200_80_60/0.7)] ring-4 ring-background transition-transform active:scale-95">
              <Icon className="size-6" />
            </span>
          ) : (
            <span className="relative">
              <Icon className={cn("size-[22px] transition-colors", on ? "text-primary" : "text-muted-foreground")} />
              {t.href === "/notifications" && unread > 0 && <span className="absolute -top-1 -right-1.5 grid min-w-4 place-items-center rounded-full bg-[#ff907d] px-1 text-[10px] font-bold text-[#053e42]">{unread > 9 ? "9+" : unread}</span>}
            </span>
          );
          const cls = cn("flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium", on ? "text-primary" : "text-muted-foreground");
          return (
            <li key={t.label} className="flex flex-1">
              {t.menu ? (
                <button type="button" onClick={() => setOpenMobile(true)} className={cls}>
                  {body}
                  <span>{t.label}</span>
                </button>
              ) : (
                <Link href={t.href!} className={cls} aria-current={on ? "page" : undefined}>
                  {body}
                  <span className={cn("max-w-[72px] truncate", t.primary && "font-semibold text-foreground")}>{t.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
