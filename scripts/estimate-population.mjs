// Оценка населения микрорайонов Актау (для «индекса боли», ДОПОЛНЕНИЕ 2).
// Запуск: node scripts/estimate-population.mjs
//
// Официальной численности по микрорайонам в открытом доступе нет. Есть население города:
// 303 752 жителя на декабрь 2025 (lada.kz со ссылкой на данные статистики).
// Метод: городское население распределяется по микрорайонам пропорционально ЖИЛОЙ ПЛОЩАДИ
//   жилая площадь здания = площадь контура (OSM) × этажность (building:levels; нет тега — по типу)
// Почему не число адресов: девятиэтажка и частный дом — по одному адресу, а жителей в них
// отличается в десятки раз; пригороды с частным сектором выглядели бы перенаселёнными.
// Результат: data/population.json + districts.population в БД.

import { writeFile, readFile } from "node:fs/promises";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const CITY_POPULATION = 303752;
const CITY_POPULATION_SOURCE = "https://www.lada.kz/society/society/146714-chislennost-naseleniia-aktau-prevysila-300-tysiach-chelovek.html";
const OVERPASS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter"];
const B = "43.55,51.1,43.72,51.3";

// Жилые типы и этажность по умолчанию, если в OSM нет building:levels
const RESIDENTIAL = { apartments: 5, residential: 3, house: 1, detached: 1, semidetached_house: 1, terrace: 2, dormitory: 4, yes: null };

async function overpass(q) {
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "AIQYN-hackathon/0.1 (Smart City Aktau)" },
        body: "data=" + encodeURIComponent(`[out:json][timeout:240];${q}`),
      });
      if (res.ok) return (await res.json()).elements;
      console.log(url, res.status);
    } catch (e) {
      console.log(url, e.message);
    }
  }
  throw new Error("Overpass недоступен");
}

// Площадь полигона в м² (локальная проекция)
function area(coords) {
  const lat0 = coords[0].lat;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  let s = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++)
    s += (coords[j].lon * kx) * (coords[i].lat * ky) - (coords[i].lon * kx) * (coords[j].lat * ky);
  return Math.abs(s / 2);
}

function inRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPoly = (p, poly) => (poly.type === "Polygon" ? [poly.coordinates] : poly.coordinates).some((r) => inRing(p, r[0]));

console.log("Здания OSM…");
const els = await overpass(`(way["building"](${B}););out tags geom;`);
console.log("зданий:", els.length);

const districts = JSON.parse(await readFile("data/districts.normalized.json", "utf8")).items.filter((d) => d.polygon && d.kind !== "zone");
const floor = Object.fromEntries(districts.map((d) => [d.code, { floor_m2: 0, buildings: 0 }]));
let used = 0, cityFloor = 0;

for (const el of els) {
  const type = el.tags?.building;
  if (!(type in RESIDENTIAL) || !el.geometry || el.geometry.length < 4) continue;
  const a = area(el.geometry);
  if (a < 30 || a > 20000) continue; // шум и нежилые гиганты
  let levels = Number(el.tags["building:levels"]);
  if (!levels) {
    if (RESIDENTIAL[type] != null) levels = RESIDENTIAL[type];
    else levels = a > 400 ? 5 : 1; // «building=yes»: крупный контур в Актау — как правило многоэтажка
  }
  const c = { lat: el.geometry.reduce((s, p) => s + p.lat, 0) / el.geometry.length, lng: el.geometry.reduce((s, p) => s + p.lon, 0) / el.geometry.length };
  const d = districts.find((d) => inPoly(c, d.polygon));
  const f = a * Math.min(levels, 25);
  cityFloor += f;
  if (!d) continue;
  floor[d.code].floor_m2 += f;
  floor[d.code].buildings++;
  used++;
}

const inDistricts = Object.values(floor).reduce((s, x) => s + x.floor_m2, 0);
const items = districts
  .map((d) => ({
    code: d.code,
    name_ru: d.name_ru,
    residential_buildings: floor[d.code].buildings,
    floor_m2: Math.round(floor[d.code].floor_m2),
    population_est: Math.round((CITY_POPULATION * floor[d.code].floor_m2) / cityFloor),
  }))
  .sort((a, b) => b.population_est - a.population_est);

await writeFile(
  "data/population.json",
  JSON.stringify(
    {
      method: "Население города распределено по микрорайонам пропорционально жилой площади (контур здания OSM × этажность). Оценка, не официальная статистика.",
      city_population: CITY_POPULATION,
      city_population_source: CITY_POPULATION_SOURCE,
      osm_license: "ODbL 1.0",
      computed_at: new Date().toISOString(),
      share_inside_known_districts: Math.round((100 * inDistricts) / cityFloor),
      items,
    },
    null,
    1
  )
);
console.log(`жилых зданий в микрорайонах: ${used}; доля жилой площади внутри известных полигонов: ${Math.round((100 * inDistricts) / cityFloor)}%`);
console.table(items.slice(0, 12));

config({ path: ".env.local" });
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  for (const it of items) await db.from("districts").update({ population: it.population_est }).eq("code", it.code);
  console.log("districts.population обновлено");
}
