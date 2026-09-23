import Link from "next/link";
import { ArrowUpRight, Phone } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { FooterShell } from "@/components/footer-shell";

export async function SiteFooter() {
  const { t } = await getDict();
  const cols = [
    {
      title: t.footer.platform,
      links: [
        { href: "/map", label: t.nav.map },
        { href: "/report/new", label: t.nav.report },
        { href: "/incidents", label: t.nav.incidents },
        { href: "/open-data", label: t.nav.openData },
      ],
    },
    {
      title: t.footer.cabinets,
      links: [
        { href: "/me", label: t.nav.me },
        { href: "/service", label: t.nav.service },
        { href: "/akimat", label: t.nav.akimat },
        { href: "/login", label: t.nav.login },
      ],
    },
  ];

  return (
    <FooterShell>
      <div className="mx-auto max-w-7xl px-4 pt-10 pb-6">
        <div className="rounded-3xl border bg-foreground/[0.03] p-6 md:p-10">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight">
                <svg viewBox="0 0 44 44" className="size-8 text-lt-teal dark:text-[#c7e99d]" aria-hidden>
                  <rect x="3" y="3" width="38" height="38" rx="11" fill="none" stroke="currentColor" strokeWidth="2.6" />
                  <path d="M22 34V13" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                  <path d="M22 20c-6.5 0-9.5-3.4-9.5-8.5 6 0 9.5 3 9.5 8.5Z" fill="currentColor" />
                  <path d="M22 28c6.5 0 9.5-3.4 9.5-8.5-6 0-9.5 3-9.5 8.5Z" fill="currentColor" />
                </svg>
                AIQYN
              </Link>
              <p className="mt-4 max-w-sm text-sm text-muted-foreground text-pretty">{t.home.notReplace}</p>
            </div>
            {cols.map((c) => (
              <div key={c.title}>
                <h2 className="text-xs font-semibold tracking-[0.14em] uppercase">{c.title}</h2>
                <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-muted-foreground transition-colors duration-200 hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-4 border-t pt-5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 AIQYN — {t.tagline}</span>
            <nav aria-label={t.footer.links} className="flex items-center gap-5">
              <a href="tel:109" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Phone className="size-3.5" /> 109
              </a>
              <a href="https://eotinish.kz" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                eOtinish <ArrowUpRight className="size-3.5" />
              </a>
              <a href="/api/public/v1/reports" className="transition-colors hover:text-foreground">
                API
              </a>
            </nav>
          </div>
        </div>
      </div>
    </FooterShell>
  );
}
