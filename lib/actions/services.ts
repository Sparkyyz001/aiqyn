"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { msg } from "@/lib/i18n/server";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Оценка службы жителем: одна на человека, можно изменить */
export async function rateService(code: string, stars: number): Promise<Result<{ avg: number; count: number }>> {
  const me = await getProfile();
  if (!me) return { ok: false, error: await msg("login") };
  const s = Math.round(stars);
  if (s < 1 || s > 5) return { ok: false, error: await msg("forbidden") };
  const ref = await getReference();
  const svc = ref.serviceByCode.get(code);
  if (!svc) return { ok: false, error: await msg("notFound") };
  const db = createAdminClient();
  const { data: prev } = await db.from("service_ratings").select("id").eq("service_id", svc.id).eq("user_id", me.id).maybeSingle();
  if (prev) await db.from("service_ratings").update({ stars: s, updated_at: new Date().toISOString() }).eq("id", prev.id);
  else await db.from("service_ratings").insert({ service_id: svc.id, user_id: me.id, stars: s });
  const { data } = await db.from("service_ratings").select("stars").eq("service_id", svc.id);
  const list = data ?? [];
  revalidatePath("/services");
  return { ok: true, data: { avg: list.reduce((a, r) => a + r.stars, 0) / Math.max(1, list.length), count: list.length } };
}
