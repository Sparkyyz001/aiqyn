import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { homeFor, type Role } from "@/lib/auth";

// Возврат из Google: обмениваем код на сессию Supabase и ведём по роли (или на ?next=)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "";
  if (!code) return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  if (next.startsWith("/") && !next.startsWith("//")) return NextResponse.redirect(new URL(next, url.origin));
  const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  return NextResponse.redirect(new URL(homeFor((p?.role ?? "citizen") as Role), url.origin));
}
