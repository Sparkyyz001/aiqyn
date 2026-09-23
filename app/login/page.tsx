import { Clock, ShieldCheck, Users } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";
import { googleEnabled } from "@/lib/auth-providers";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.login };
}

const FEATURE_ICONS = [Clock, ShieldCheck, Users];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { t } = await getDict();
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const mode = sp.mode === "signup" ? "signup" : "signin";
  const google = await googleEnabled();
  const oauthError = sp.error === "oauth";
  const a = t.auth;
  return (
    <div className="grid min-h-[calc(100svh-3.5rem)] flex-1 grid-rows-[auto_1fr] lg:grid-cols-2 lg:grid-rows-1">
      {/* Левая половина — пейзаж первого экрана и что даёт платформа */}
      <aside className="relative isolate flex min-h-[260px] flex-col justify-end overflow-hidden bg-lt-deep p-6 text-lt-cream md:p-10 lg:min-h-0 lg:justify-center lg:p-14">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero/landscape.webp"
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover [filter:hue-rotate(318deg)_saturate(0.72)_brightness(1.1)_contrast(0.9)] motion-safe:animate-[login-breath_18s_ease-in-out_infinite_alternate]"
          style={{ objectPosition: "70% 45%" }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#053e42] via-[#053e42]/75 to-[#053e42]/20 lg:bg-gradient-to-r lg:from-[#053e42]/95 lg:via-[#053e42]/70 lg:to-[#053e42]/10" />
        <div className="max-w-md">
          <h1 className="text-3xl leading-[1.05] font-semibold tracking-tight md:text-5xl">
            {a.sideTitle1}
            <br />
            <em className="font-serif font-normal text-lt-coral">{a.sideTitle2}</em>
          </h1>
          <p className="mt-4 hidden text-sm text-lt-cream/75 text-pretty sm:block md:text-base">{a.sideSub}</p>
          <ul className="mt-8 hidden flex-col gap-4 lg:flex">
            {a.sideFeatures.map(([title, sub], i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <li key={i} className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-lt-cream/10 backdrop-blur">
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-lt-cream/65">{sub}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mt-10 hidden text-xs text-lt-cream/50 lg:absolute lg:bottom-8 lg:left-14 lg:block">© 2026 AIQYN · {t.tagline}</p>
      </aside>

      {/* Правая половина — форма */}
      <div className="flex items-center justify-center px-4 py-10 md:px-10">
        <div className="w-full max-w-md">
          <LoginForm t={t} next={next} mode={mode} google={google} oauthError={oauthError} />
        </div>
      </div>
    </div>
  );
}
