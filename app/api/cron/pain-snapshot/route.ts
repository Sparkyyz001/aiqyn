import { flow } from "@/lib/data";
import { getReference } from "@/lib/reference";
import { painIndex } from "@/lib/pain-index";
import { snapshotPain } from "@/lib/pain-data";

export const maxDuration = 300;

// Ежедневный снимок индекса боли (Vercel Cron, vercel.json). Защищён CRON_SECRET.
// ?backfill=90 — заполнить историю за 90 дней, восстановив состояние потока на каждую дату
// (что было открыто и что закрыто за последние 30 дней на тот день).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const days = Math.min(120, Math.max(1, Number(url.searchParams.get("backfill") ?? 1)));
  const [{ all }, ref] = await Promise.all([flow(), getReference()]);
  const districts = ref.districts.filter((d) => d.kind !== "zone").map((d) => ({ code: d.code, population: d.population }));

  let written = 0;
  for (let i = days - 1; i >= 0; i--) {
    const at = Date.now() - i * 86400_000;
    const date = new Date(at + 5 * 3600_000).toISOString().slice(0, 10); // дата по Актау
    written += await snapshotPain(painIndex(all, districts, at), date);
  }
  return Response.json({ ok: true, days, written });
}
