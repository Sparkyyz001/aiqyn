"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    options: { data: { full_name: String(form.get("full_name") ?? "").trim() } },
  });
  if (error) return { error: error.message };
  return { to: "/me" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function setLang(lang: "ru" | "kz") {
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
