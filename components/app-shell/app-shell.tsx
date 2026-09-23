import { getProfile } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LangSwitch } from "@/components/lang-switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "./app-sidebar";
import { ShellSwitch } from "./shell-switch";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [{ lang, t }, profile] = await Promise.all([getDict(), getProfile()]);
  const a = t.akimat.nav;

  const titles: [string, string][] = [
    ["/map", t.nav.map],
    ["/incidents", t.nav.incidents],
    ["/open-data", t.nav.openData],
    ["/report/new", t.shell.report],
    ["/report", t.nav.map],
    ["/district", t.akimat.nav.pain],
    ["/me", t.nav.me],
    ["/service", t.nav.service],
    ["/operator", t.nav.operator],
    ["/akimat", a.overview],
    ["/akimat/risk", a.risk],
    ["/akimat/pain", a.pain],
    ["/akimat/clusters", a.clusters],
    ["/akimat/quality", a.quality],
    ["/akimat/money", a.money],
    ["/akimat/forecast", a.forecast],
    ["/akimat/air", a.air],
    ["/akimat/light", a.light],
  ];

  return (
    <ShellSwitch
      header={<SiteHeader />}
      footer={<SiteFooter />}
      titles={titles}
      tools={
        <>
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
