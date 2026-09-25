import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Ограничение частоты дорогих вызовов (ИИ): не больше max раз за windowMin минут на пользователя.
// Счёт в базе, а не в памяти — на Vercel запросы обслуживают разные экземпляры функции.
export const LIMITS = {
  voice: { max: 10, windowMin: 10 },
  photo_ai: { max: 20, windowMin: 10 },
} as const;

export async function allowAi(userId: string, kind: keyof typeof LIMITS): Promise<boolean> {
  const { max, windowMin } = LIMITS[kind];
  const db = createAdminClient();
  const since = new Date(Date.now() - windowMin * 60_000).toISOString();
  const { count } = await db.from("ai_usage").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("kind", kind).gte("created_at", since);
  if ((count ?? 0) >= max) return false;
  await db.from("ai_usage").insert({ user_id: userId, kind });
  return true;
}
