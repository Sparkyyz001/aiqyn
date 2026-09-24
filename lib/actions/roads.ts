"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { msg } from "@/lib/i18n/server";

const VERDICTS = ["potholes", "cracks", "ok", "repaired"] as const;
type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Отзыв о состоянии участка дороги: один на человека, можно изменить */
export async function roadFeedback(osmId: string, verdict: string): Promise<Result<Record<string, number>>> {
  const me = await getProfile();
  if (!me) return { ok: false, error: await msg("login") };
  if (!(VERDICTS as readonly string[]).includes(verdict) || !/^(way|relation)\/\d+$/.test(osmId)) return { ok: false, error: await msg("forbidden") };
  const db = createAdminClient();
  const { data: prev } = await db.from("road_feedback").select("id").eq("osm_id", osmId).eq("user_id", me.id).maybeSingle();
  if (prev) await db.from("road_feedback").update({ verdict, updated_at: new Date().toISOString() }).eq("id", prev.id);
  else await db.from("road_feedback").insert({ osm_id: osmId, user_id: me.id, verdict });
  const { data } = await db.from("road_feedback").select("verdict").eq("osm_id", osmId);
  const counts: Record<string, number> = { potholes: 0, cracks: 0, ok: 0, repaired: 0 };
  for (const r of data ?? []) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
  revalidatePath("/akimat/forecast");
  return { ok: true, data: counts };
}
