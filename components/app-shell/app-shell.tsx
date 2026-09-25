import { getProfile } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LangSwitch } from "@/components/lang-switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "./app-sidebar";
import { ShellSwitch } from "./shell-switch";
import { NotificationBell } from "@/components/notifications/bell";
import { BottomNav } from "./bottom-nav";
import { createAdminClient } from "@/lib/supabase/admin";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [{ lang, t }, profile] = await Promise.all([getDict(), getProfile()]);
  const a = t.akimat.nav;
  const unread = profile
    ? (await createAdminClient().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile.id).is("read_at", null)).count ?? 0
    : 0;

  const titles: [string, string][] = [
    ["/map", t.nav.map],
    ["/incidents", t.nav.incidents],
    ["/services", t.services.title],
    ["/initiatives", t.initiatives.title],
    ["/report/new", t.shell.report],
    ["/report", t.shell.reportCard],
    ["/district", t.pain.districtsTitle],
    ["/me", t.nav.me],
    ["/notifications", t.notify.title],
    ["/service", t.nav.service],
    ["/operator", t.nav.operator],
    ["/akimat", a.overview],
    ["/akimat/risk", a.risk],
    ["/akimat/digest", t.digest.nav],
    ["/budget", t.budget.nav],
    ["/akimat/pain", a.pain],
    ["/akimat/clusters", a.clusters],
    ["/akimat/quality", a.quality],
    ["/akimat/money", a.money],
    ["/akimat/forecast", a.forecast],
    ["/akimat/air", a.air],
  ];

  return (
    <ShellSwitch
      header={<SiteHeader />}
      footer={<SiteFooter />}
      titles={titles}
      bottom={
        <BottomNav
          role={profile?.role ?? null}
          unread={unread}
          l={{
            map: t.nav.map,
            me: t.shell.tabs.me,
            report: t.shell.tabs.report,
            notifications: t.shell.tabs.notifications,
            menu: t.nav.menu,
            login: t.nav.login,
            initiatives: t.initiatives.nav,
            service: t.shell.tabs.service,
            operator: t.shell.tabs.operator,
            overview: t.shell.tabs.overview,
            risk: t.shell.tabs.risk,
            digest: t.shell.tabs.digest,
          }}
        />
      }
      tools={
        <>
          {profile && <NotificationBell userId={profile.id} lang={lang} t={t.notify} />}
          <LangSwitch lang={lang} label={t.common.lang} />
          <ThemeToggle label={t.common.theme} />
        </>
      }
      sidebar={
        <AppSidebar
          user={profile ? { name: profile.full_name ?? t.roles[profile.role], role: profile.role } : null}
          l={{
            city: t.shell.city,
            cabinet: t.shell.cabinet,
            akimat: t.shell.akimat,
            guest: t.shell.guest,
            guestHint: t.shell.guestHint,
            report: t.shell.report,
            notifications: t.notify.title,
            services: t.services.nav,
            districts: t.pain.districtsTitle,
            initiatives: t.initiatives.nav,
            budget: t.budget.nav,
            digest: t.digest.nav,
            nav: t.nav,
            akimatNav: a,
            roles: t.roles,
          }}
        />
      }
    >
      {children}
    </ShellSwitch>
  );
}
