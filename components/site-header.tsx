import Link from "next/link";
import { LogIn, LogOut, Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { getProfile, type Role } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { signOut } from "@/lib/actions/session";
import { LangSwitch } from "@/components/lang-switch";
import { ThemeToggle } from "@/components/theme-toggle";

export async function SiteHeader() {
  const [{ lang, t }, profile] = await Promise.all([getDict(), getProfile()]);

  const publicLinks = [
    { href: "/map", label: t.nav.map },
    { href: "/incidents", label: t.nav.incidents },
  ];
  const cabinet: Record<Role, { href: string; label: string }> = {
    citizen: { href: "/me", label: t.nav.me },
    service: { href: "/service", label: t.nav.service },
    akimat: { href: "/akimat", label: t.nav.akimat },
    operator: { href: "/operator", label: t.nav.operator },
  };
  const links = profile ? [...publicLinks, cabinet[profile.role]] : publicLinks;

  return (
    <header className="sticky top-0 z-[1100] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">A</span>
          <span>AIQYN</span>
          <span className="hidden text-xs font-normal text-muted-foreground lg:inline">· Ақтау</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Button key={l.href} asChild variant="ghost" size="sm">
              <Link href={l.href}>{l.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/report/new">
              <Plus /> {t.nav.report}
            </Link>
          </Button>
          <LangSwitch lang={lang} label={t.common.lang} />
          <ThemeToggle label={t.common.theme} />
          {profile ? (
            <form action={signOut} className="hidden md:block">
              <Button variant="ghost" size="sm" title={profile.full_name ?? ""}>
                <LogOut /> <span className="hidden lg:inline">{t.nav.logout}</span>
              </Button>
            </form>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href="/login">
                <LogIn /> {t.nav.login}
              </Link>
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t.nav.menu}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="z-[1200] w-72">
              <SheetHeader>
                <SheetTitle>AIQYN</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                <Button asChild className="mb-2">
                  <Link href="/report/new">
                    <Plus /> {t.nav.report}
                  </Link>
                </Button>
                {links.map((l) => (
                  <Button key={l.href} asChild variant="ghost" className="justify-start">
                    <Link href={l.href}>{l.label}</Link>
                  </Button>
                ))}
                <Separator className="my-2" />
                {profile ? (
                  <>
                    <p className="px-3 text-sm text-muted-foreground">
                      {profile.full_name} · {t.roles[profile.role]}
                    </p>
                    <form action={signOut}>
                      <Button variant="ghost" className="w-full justify-start">
                        <LogOut /> {t.nav.logout}
                      </Button>
                    </form>
                  </>
                ) : (
                  <Button asChild variant="ghost" className="justify-start">
                    <Link href="/login">
                      <LogIn /> {t.nav.login}
                    </Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
