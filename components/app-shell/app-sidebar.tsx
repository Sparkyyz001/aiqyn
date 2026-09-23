"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronsUpDown,
  CircleDollarSign,
  Database,
  Flame,
  Headset,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  Map as MapIcon,
  MoonStar,
  Plus,
  Route,
  ShieldAlert,
  Siren,
  Wind,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/lib/actions/session";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Role } from "@/lib/auth";

export type ShellLabels = {
  city: string;
  cabinet: string;
  akimat: string;
  guest: string;
  guestHint: string;
  report: string;
  nav: { map: string; incidents: string; openData: string; me: string; service: string; operator: string; login: string; logout: string };
  akimatNav: { overview: string; risk: string; pain: string; clusters: string; quality: string; money: string; forecast: string; air: string; light: string };
  roles: Record<Role, string>;
};

type Item = { title: string; url: string; icon: LucideIcon };

// Боковое меню приложения: сверху главное действие, ниже разделы по смыслу —
// город (публичное), свой кабинет (по роли), аналитика акимата. Плоский список
// из пятнадцати пунктов читать тяжело, группы дают зацепиться взглядом.
export function AppSidebar({ user, l }: { user: { name: string; role: Role } | null; l: ShellLabels }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const city: Item[] = [
    { title: l.nav.map, url: "/map", icon: MapIcon },
    { title: l.nav.incidents, url: "/incidents", icon: Siren },
    { title: l.nav.openData, url: "/open-data", icon: Database },
  ];
  const cabinet: Item[] = !user
    ? []
    : user.role === "citizen"
      ? [{ title: l.nav.me, url: "/me", icon: Inbox }]
      : user.role === "service"
        ? [{ title: l.nav.service, url: "/service", icon: Wrench }]
        : user.role === "operator"
          ? [{ title: l.nav.operator, url: "/operator", icon: Headset }]
          : [];
  const akimat: Item[] =
    user && (user.role === "akimat" || user.role === "operator")
      ? [
          { title: l.akimatNav.overview, url: "/akimat", icon: LayoutDashboard },
          { title: l.akimatNav.risk, url: "/akimat/risk", icon: ShieldAlert },
          { title: l.akimatNav.pain, url: "/akimat/pain", icon: Flame },
          { title: l.akimatNav.clusters, url: "/akimat/clusters", icon: Building2 },
          { title: l.akimatNav.quality, url: "/akimat/quality", icon: BarChart3 },
          { title: l.akimatNav.money, url: "/akimat/money", icon: CircleDollarSign },
          { title: l.akimatNav.forecast, url: "/akimat/forecast", icon: Route },
          { title: l.akimatNav.air, url: "/akimat/air", icon: Wind },
          { title: l.akimatNav.light, url: "/akimat/light", icon: MoonStar },
        ]
      : [];

  const isActive = (url: string) => (url === "/akimat" ? pathname === "/akimat" : pathname === url || pathname.startsWith(url + "/"));

  const renderItems = (items: Item[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)} className="transition-colors duration-200">
          <Link href={item.url} onClick={() => setOpenMobile(false)}>
            <item.icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  const initials = (user?.name ?? l.guest)
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="hover:bg-transparent active:bg-transparent">
              <Link href="/" onClick={() => setOpenMobile(false)}>
                <svg viewBox="0 0 44 44" className="size-8! text-[#c7e99d]" aria-hidden>
                  <rect x="3" y="3" width="38" height="38" rx="11" fill="none" stroke="currentColor" strokeWidth="2.6" />
                  <path d="M22 34V13" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                  <path d="M22 20c-6.5 0-9.5-3.4-9.5-8.5 6 0 9.5 3 9.5 8.5Z" fill="currentColor" />
                  <path d="M22 28c6.5 0 9.5-3.4 9.5-8.5-6 0-9.5 3-9.5 8.5Z" fill="currentColor" />
                </svg>
                <span className="grid leading-tight">
                  <span className="text-base font-semibold tracking-tight">AIQYN</span>
                  <span className="text-[11px] text-sidebar-foreground/60">Ақтау</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Главное действие — всегда первым */}
        <SidebarGroup className="pb-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={l.report}
                  className="btn-shine h-10 bg-sidebar-primary font-semibold text-sidebar-primary-foreground transition-transform duration-300 hover:-translate-y-0.5 hover:bg-sidebar-primary hover:text-sidebar-primary-foreground active:bg-sidebar-primary active:text-sidebar-primary-foreground"
                >
                  <Link href="/report/new" onClick={() => setOpenMobile(false)}>
                    <Plus />
                    <span>{l.report}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="py-1">
          <SidebarGroupLabel>{l.city}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(city)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {cabinet.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel>{l.cabinet}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(cabinet)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {akimat.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel>{l.akimat}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(akimat)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">{initials}</span>
                    <span className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs text-sidebar-foreground/60">{l.roles[user.role]}</span>
                    </span>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="z-[1300] w-(--radix-dropdown-menu-trigger-width) min-w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{l.roles[user.role]}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <form action={signOut}>
                    <DropdownMenuItem asChild>
                      <button type="submit" className="w-full">
                        <LogOut /> {l.nav.logout}
                      </button>
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton asChild size="lg" tooltip={l.nav.login}>
                <Link href="/login" onClick={() => setOpenMobile(false)}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-accent">
                    <LogIn className="size-4" />
                  </span>
                  <span className="grid flex-1 text-left text-sm leading-tight">
                    <span className="font-medium">{l.nav.login}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">{l.guestHint}</span>
                  </span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
