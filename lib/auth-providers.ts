import "server-only";

let cache: { at: number; google: boolean } | null = null;

/** Включён ли вход через Google в Supabase (кэш 5 минут) */
export async function googleEnabled(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 300_000) return cache.google;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      cache: "no-store",
    });
    const j = await res.json();
    cache = { at: Date.now(), google: !!j?.external?.google };
  } catch {
    cache = { at: Date.now(), google: false };
  }
  return cache.google;
}
