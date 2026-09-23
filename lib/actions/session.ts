"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { homeFor, type Role } from "@/lib/auth";

// to — куда перейти после входа; переход делает браузер (полная загрузка, чтобы шапка
// и кабинеты гарантированно отрисовались уже с новой сессией)
export type AuthState = { error?: string; to?: string } | undefined;

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error || !data.user) return { error: "invalid" };

  const next = String(form.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) return { to: next };

  const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  return { to: homeFor((p?.role ?? "citizen") as Role) };
}

// Регистрация: аккаунт создаётся сервером сразу подтверждённым (без письма) и человек сразу входит.
// Письмо-подтверждение на хакатонном демо только мешает: без SMTP оно может не дойти.
export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const full_name = String(form.get("full_name") ?? "").trim();
  if (!email || password.length < 6) return { error: "short" };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (error) return { error: /already|registered|exists/i.test(error.message) ? "exists" : error.message };
  const supabase = await createClient();
  const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
  if (e2) return { error: e2.message };
  const next = String(form.get("next") ?? "");
  return { to: next.startsWith("/") && !next.startsWith("//") ? next : "/me" };
}

/** Вход через Google (OAuth Supabase). Провайдер включается в Supabase → Authentication → Providers. */
export async function signInWithGoogle(next: string): Promise<{ url?: string; error?: string }> {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next || "")}` },
  });
  if (error || !data.url) return { error: error?.message ?? "oauth" };
  return { url: data.url };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function setLang(lang: "ru" | "kz") {
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
