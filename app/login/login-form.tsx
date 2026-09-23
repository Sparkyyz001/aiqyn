"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp, signInWithGoogle } from "@/lib/actions/session";
import { useTransition } from "react";
import type { Dict } from "@/lib/i18n/dict";

// Тестовые аккаунты всех 4 ролей — жюри должно зайти и потыкать само (ТЗ, раздел 11)
const DEMO = [
  { email: "citizen@aiqyn.kz", role: "citizen" },
  { email: "kzhsa@aiqyn.kz", role: "service", note: "КЖСА" },
  { email: "roads@aiqyn.kz", role: "service", note: "ПТиАД" },
  { email: "akimat@aiqyn.kz", role: "akimat" },
  { email: "operator@aiqyn.kz", role: "operator" },
] as const;

export function LoginForm({ t, next, mode, google, oauthError }: { t: Dict; next: string; mode: "signin" | "signup"; google: boolean; oauthError: boolean }) {
  const [gPending, gStart] = useTransition();
  const [state, action, pending] = useActionState(mode === "signup" ? signUp : signIn, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.to) window.location.assign(state.to);
  }, [state]);

  const fillDemo = (email: string) => {
    const f = formRef.current;
    if (!f) return;
    (f.elements.namedItem("email") as HTMLInputElement).value = email;
    (f.elements.namedItem("password") as HTMLInputElement).value = "aiqyn2026";
    f.requestSubmit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "signup" ? t.auth.signupTitle : t.auth.title}</CardTitle>
        <CardDescription>{t.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {oauthError && <p className="text-sm text-destructive">{t.auth.oauthError}</p>}
        {google && (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={gPending}
              onClick={() =>
                gStart(async () => {
                  const res = await signInWithGoogle(next);
                  if (res.url) window.location.assign(res.url);
                })
              }
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.6 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"/></svg>
              {t.auth.google}
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t.auth.or}
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <form ref={formRef} action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          {mode === "signup" && (
            <div className="grid gap-2">
              <Label htmlFor="full_name">{t.auth.fullName}</Label>
              <Input id="full_name" name="full_name" required autoComplete="name" />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input id="password" name="password" type="password" required minLength={6} placeholder={mode === "signup" ? t.auth.minPass : undefined} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error === "invalid" ? t.auth.error : state.error === "exists" ? t.auth.exists : state.error === "short" ? t.auth.short : state.error}</p>
          )}
          <Button type="submit" disabled={pending || !!state?.to}>
            {pending ? t.common.loading : mode === "signup" ? t.auth.signup : t.auth.submit}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "signup" ? t.auth.haveAccount : t.auth.noAccount}{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href={mode === "signup" ? "/login" : "/login?mode=signup"}>
              {mode === "signup" ? t.auth.submit : t.auth.signup}
            </Link>
          </p>
        </form>

        {mode === "signin" && (
          <details className="rounded-md border bg-muted/40 p-3">
            <summary className="cursor-pointer text-sm font-medium">{t.auth.demoToggle}</summary>
            <p className="mt-2 mb-2 text-xs text-muted-foreground">{t.auth.demoHint}</p>
            <div className="flex flex-col gap-1">
              {DEMO.map((d) => (
                <Button key={d.email} type="button" variant="ghost" size="sm" className="h-auto justify-between py-1.5" disabled={pending} onClick={() => fillDemo(d.email)}>
                  <span className="font-mono text-xs">{d.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.roles[d.role]}
                    {"note" in d ? ` · ${d.note}` : ""}
                  </span>
                </Button>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
