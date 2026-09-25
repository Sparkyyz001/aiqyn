import "server-only";
import { unstable_cache } from "next/cache";
import { flow } from "@/lib/data";
import { backtrace, MAX_DIST_M, type WindObs } from "@/lib/wind";
import { AKTAU_CENTER, bearing, haversine, type LatLng } from "@/lib/geo";
import weather from "@/data/weather_history.json";

// «Сегодня в Актау»: погода и ветер на 12 часов (Open-Meteo), прогноз запаха для микрорайона жителя.
// Запах: зона вероятного источника — та же обратная трассировка по ветру, что у акимата (/akimat/air).
// Если ветер в ближайшие часы дует со стороны этой зоны на дом жителя — предупреждаем заранее.

export type Hour = { t: string; deg: number; speed: number; temp: number; smell: boolean };
export type Today = { temp: number; deg: number; speed: number; hours: Hour[] } | null;

const OBS: WindObs[] = (weather.items as { t: string; wind_deg: number; wind_speed: number }[])
  .map((w) => ({ t: new Date(w.t + ":00+05:00").getTime(), deg: w.wind_deg, speed: w.wind_speed }))
  .sort((a, b) => a.t - b.t);

// Центр зоны, куда чаще всего указывает ветер в моменты жалоб на запах; пересчёт раз в 6 часов
export const smellSource = unstable_cache(
  async (): Promise<LatLng | null> => {
    const { all } = await flow();
    const smell = all.filter((r) => r.category === "smell");
    if (smell.length < 5) return null;
    const { cells } = backtrace(smell.map((r) => ({ lat: r.lat, lng: r.lng, time: new Date(r.created_at).getTime() })), OBS, AKTAU_CENTER);
    const core = cells.filter((c) => c.votes >= 0.7);
    if (!core.length) return null;
    const w = core.reduce((s, c) => s + c.votes, 0);
    return { lat: core.reduce((s, c) => s + c.lat * c.votes, 0) / w, lng: core.reduce((s, c) => s + c.lng * c.votes, 0) / w };
  },
  ["smell-source-v1"],
  { revalidate: 6 * 3600 }
);

const angle = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Погода на 12 часов и часы, когда к дому может нести запах из зоны источника */
export async function today(home: LatLng): Promise<Today> {
  const [src, w] = await Promise.all([
    smellSource().catch(() => null),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${AKTAU_CENTER.lat}&longitude=${AKTAU_CENTER.lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,wind_speed_10m,wind_direction_10m&forecast_hours=12&wind_speed_unit=ms&timezone=Asia%2FAqtau`,
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(4000) }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  if (!w?.current || !w?.hourly) return null;
  // ветер «откуда дует» совпадает с направлением на источник (±30°), источник не дальше 15 км, не штиль
  const toSrc = src ? bearing(home, src) : null;
  const near = src ? haversine(home, src) <= MAX_DIST_M : false;
  const smelly = (deg: number, speed: number) => toSrc != null && near && speed >= 1 && angle(deg, toSrc) <= 30;
  const h = w.hourly as { time: string[]; temperature_2m: number[]; wind_speed_10m: number[]; wind_direction_10m: number[] };
  return {
    temp: Math.round(w.current.temperature_2m),
    deg: w.current.wind_direction_10m,
    speed: Math.round(w.current.wind_speed_10m * 10) / 10,
    hours: h.time.map((t, i) => ({
      t,
      deg: h.wind_direction_10m[i],
      speed: h.wind_speed_10m[i],
      temp: Math.round(h.temperature_2m[i]),
      smell: smelly(h.wind_direction_10m[i], h.wind_speed_10m[i]),
    })),
  };
}

