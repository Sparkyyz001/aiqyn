import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, PT_Serif } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell/app-shell";
import { Pwa } from "@/components/pwa";
import { getLang } from "@/lib/i18n/server";
import { DICTS } from "@/lib/i18n/dict";
import "./globals.css";

// cyrillic-ext нужен для казахских букв ә ғ қ ң ө ұ ү һ і
const sans = Inter({ variable: "--font-sans", subsets: ["latin", "cyrillic", "cyrillic-ext"] });
const mono = JetBrains_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic"] });
const serif = PT_Serif({ variable: "--font-serif", subsets: ["latin", "cyrillic", "cyrillic-ext"], weight: ["400"], style: ["normal", "italic"] });

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const { t } = { t: DICTS[lang] };
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://aiqyn-aktau.vercel.app"),
    title: { default: t.meta.title, template: "%s · AIQYN" },
    description: t.meta.description,
    applicationName: "AIQYN",
    appleWebApp: { capable: true, title: "AIQYN", statusBarStyle: "black-translucent" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#171b22" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang === "kz" ? "kk" : "ru"} suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
            <Toaster position="top-center" />
            <Pwa />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
