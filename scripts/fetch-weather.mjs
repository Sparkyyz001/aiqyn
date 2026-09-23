// Погода Актау из Open-Meteo (открытый API, без ключа, CC BY 4.0).
// Запуск: node scripts/fetch-weather.mjs
//  - data/weather_history.json — почасовой ветер/температура за последние 90 дней
//    (для обратной трассировки запаха, раздел 8.2)
//  - data/weather_daily.json — суточные min/max температуры за 3 года
//    (переходы через 0 °C — признак для прогноза разрушения дорог, раздел 8.1)

import { writeFile, mkdir } from "node:fs/promises";

const LAT = 43.65;
const LNG = 51.16;
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400_000);

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

await mkdir("data", { recursive: true });

// Архив отстаёт от текущей даты на несколько дней — берём до now-2
const hourlyUrl =
  `${ARCHIVE}?latitude=${LAT}&longitude=${LNG}` +
  `&start_date=${iso(daysAgo(92))}&end_date=${iso(daysAgo(2))}` +
  `&hourly=wind_direction_10m,wind_speed_10m,temperature_2m&timezone=Asia%2FAqtau&wind_speed_unit=ms`;
const h = await get(hourlyUrl);
const hourly = h.hourly.time.map((t, i) => ({
  t,
  wind_deg: h.hourly.wind_direction_10m[i],
  wind_speed: h.hourly.wind_speed_10m[i],
  temp: h.hourly.temperature_2m[i],
})).filter((r) => r.wind_deg != null);
await writeFile(
  "data/weather_history.json",
  JSON.stringify({
    source: "Open-Meteo Historical Weather API",
    license: "CC BY 4.0",
    api_url: hourlyUrl,
    fetched_at: new Date().toISOString(),
    lat: LAT, lng: LNG, timezone: "Asia/Aqtau", wind_speed_unit: "m/s",
    items: hourly,
  })
);
console.log(`data/weather_history.json: ${hourly.length} часов`);

const dailyUrl =
  `${ARCHIVE}?latitude=${LAT}&longitude=${LNG}` +
  `&start_date=${iso(daysAgo(3 * 365))}&end_date=${iso(daysAgo(2))}` +
  `&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&timezone=Asia%2FAqtau`;
const d = await get(dailyUrl);
const daily = d.daily.time.map((t, i) => ({
  date: t,
  tmin: d.daily.temperature_2m_min[i],
  tmax: d.daily.temperature_2m_max[i],
  precip: d.daily.precipitation_sum[i],
})).filter((r) => r.tmin != null);
const freezeThaw = daily.filter((r) => r.tmin < 0 && r.tmax > 0).length;
await writeFile(
  "data/weather_daily.json",
  JSON.stringify({
    source: "Open-Meteo Historical Weather API",
    license: "CC BY 4.0",
    api_url: dailyUrl,
    fetched_at: new Date().toISOString(),
    lat: LAT, lng: LNG,
    freeze_thaw_days: freezeThaw,
    items: daily,
  })
);
console.log(`data/weather_daily.json: ${daily.length} дней, переходов через 0 °C: ${freezeThaw}`);
