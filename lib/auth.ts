import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "citizen" | "service" | "akimat" | "operator";

export type Profile = {
  id: string;
  role: Role;
  service_id: number | null;
  full_name: string | null;
  district_id: number | null;
  reputation: number;
  lang: "ru" | "kz";
};

// Текущий пользователь и его профиль (роль берётся из БД, не из клиента)
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, service_id, full_name, district_id, reputation, lang")
    .eq("id", data.user.id)
    .single();
  return (profile as Profile) ?? null;
});

export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (roles.length && !roles.includes(profile.role)) redirect("/");
  return profile;
}

// Куда вести пользователя после входа
/** Куда вести после входа: только путь внутри сайта. «//x» и «/\x» браузер понимает как чужой домен */
export const safeNext = (next: string | null | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : null;

export const homeFor = (role: Role) =>
  ({ citizen: "/me", service: "/service", akimat: "/akimat", operator: "/operator" })[role];
