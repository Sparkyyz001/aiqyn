// Выгрузка реальной географии Актау из OpenStreetMap (Overpass API, лицензия ODbL).
// Запуск: node scripts/fetch-osm.mjs
// Результат: data/*.json. Всё, что вне bbox Актау, отбрасывается.

import { writeFile, mkdir, access } from "node:fs/promises";

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// bbox Актау (из ТЗ, раздел 1.1): south, west, north, east
const BBOX = { s: 43.55, w: 51.1, n: 43.72, e: 51.3 };
const B = `${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;

const inBbox = (lat, lng) =>
  lat >= BBOX.s && lat <= BBOX.n && lng >= BBOX.w && lng <= BBOX.e;

async function overpass(query) {
  const body = `[out:json][timeout:180];${query}`;
  let lastErr;
  for (const url of OVERPASS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            // Overpass отвечает 406 на запросы без User-Agent
            "User-Agent": "AIQYN-hackathon/0.1 (Smart City Aktau)",
          },
          body: "data=" + encodeURIComponent(body),
        });
        if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
        return (await res.json()).elements;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

// Центр элемента: node → lat/lon, way/relation → center или bounds
function center(el) {
  if (el.lat != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  if (el.bounds)
    return {
      lat: (el.bounds.minlat + el.bounds.maxlat) / 2,
      lng: (el.bounds.minlon + el.bounds.maxlon) / 2,
    };
  if (el.geometry?.length) {
    const g = el.geometry.filter(Boolean);
    return {
      lat: g.reduce((s, p) => s + p.lat, 0) / g.length,
      lng: g.reduce((s, p) => s + p.lon, 0) / g.length,
    };
  }
  return null;
}

const lineOf = (el) => (el.geometry ?? []).filter(Boolean).map((p) => [p.lon, p.lat]);

// Полигон для way/relation (для relation берём outer-члены)
function polygonOf(el) {
  if (el.type === "way" && el.geometry) {
    const ring = lineOf(el);
    if (ring.length < 4) return null;
    return { type: "Polygon", coordinates: [ring] };
  }
  if (el.type === "relation" && el.members) {
    const rings = el.members
      .filter((m) => m.role === "outer" && m.geometry)
      .map((m) => m.geometry.filter(Boolean).map((p) => [p.lon, p.lat]))
      .filter((r) => r.length >= 4);
    if (!rings.length) return null;
    return { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
  }
  return null;
}

const osmId = (el) => `${el.type}/${el.id}`;

async function save(name, payload) {
  await writeFile(`data/${name}`, JSON.stringify(payload, null, 1));
  console.log(`  → data/${name}: ${payload.items.length} объектов`);
}

const meta = (query) => ({
  source: "OpenStreetMap contributors, Overpass API",
  license: "ODbL 1.0",
  fetched_at: new Date().toISOString(),
  bbox: BBOX,
  query,
});

// Уже скачанные датасеты пропускаем (FORCE=1 — перекачать всё).
// Ошибка одного датасета не прерывает остальные — перезапуск докачает.
async function run(name, query, map) {
  if (!process.env.FORCE && (await access(`data/${name}`).then(() => true, () => false))) {
    console.log(`[${name}] уже есть, пропуск`);
    return;
  }
  console.log(`[${name}]`);
  let els;
  try {
    els = await overpass(query);
  } catch (e) {
    console.log(`  ✗ ${e.message} — перезапустите скрипт позже`);
    return;
  }
  const items = els
    .map(map)
    .filter(Boolean)
    .filter((x) => x.lat == null || inBbox(x.lat, x.lng));
  await save(name, { ...meta(query), items });
  await new Promise((r) => setTimeout(r, 3000)); // не долбим Overpass
}

await mkdir("data", { recursive: true });

const tagNames = (t = {}) => ({
  name: t.name ?? null,
  name_ru: t["name:ru"] ?? t.name ?? null,
  name_kz: t["name:kk"] ?? t["name:kz"] ?? null,
});

// Микрорайоны и районы
await run(
  "districts.json",
  `(nwr["place"~"^(neighbourhood|suburb|quarter|village|hamlet)$"](${B}););out geom;`,
  (el) => {
    const c = center(el);
    if (!c) return null;
    return {
      osm_id: osmId(el),
      place: el.tags?.place,
      ...tagNames(el.tags),
      ...c,
      polygon: polygonOf(el),
      population: el.tags?.population ? Number(el.tags.population) : null,
    };
  }
);

// Административные границы внутри bbox (для контура города)
await run(
  "admin_boundaries.json",
  `(relation["boundary"="administrative"]["admin_level"~"^(6|7|8|9|10)$"](${B}););out geom;`,
  (el) => {
    const c = center(el);
    return {
      osm_id: osmId(el),
      admin_level: el.tags?.admin_level,
      ...tagNames(el.tags),
      ...(c ?? {}),
      polygon: polygonOf(el),
    };
  }
);

// Дорожная сеть
await run(
  "road_segments.json",
  `(way["highway"~"^(primary|secondary|tertiary|residential|service|unclassified|trunk|living_street)$"](${B}););out geom;`,
  (el) => {
    const c = center(el);
    return {
      osm_id: osmId(el),
      highway: el.tags?.highway,
      ...tagNames(el.tags),
      surface: el.tags?.surface ?? null,
      lanes: el.tags?.lanes ? Number(el.tags.lanes) : null,
      lit: el.tags?.lit ?? null,
      ...c,
      geometry: { type: "LineString", coordinates: lineOf(el) },
    };
  }
);

// Уличное освещение
await run("lighting_points.json", `(node["highway"="street_lamp"](${B}););out;`, (el) => ({
  osm_id: osmId(el),
  lat: el.lat,
  lng: el.lon,
}));

// Социальные объекты
await run(
  "poi_social.json",
  `(nwr["amenity"~"^(school|kindergarten|hospital|clinic|doctors|college|university)$"](${B}););out center;`,
  (el) => {
    const c = center(el);
    if (!c) return null;
    return { osm_id: osmId(el), amenity: el.tags?.amenity, ...tagNames(el.tags), ...c };
  }
);

// Остановки
await run("transit_stops.json", `(node["highway"="bus_stop"](${B});node["public_transport"="platform"](${B}););out;`, (el) => ({
  osm_id: osmId(el),
  ...tagNames(el.tags),
  lat: el.lat,
  lng: el.lon,
}));

// Автобусные маршруты (только теги, без геометрии — хватает для справочника)
await run("transit_routes.json", `(relation["route"="bus"](${B}););out tags;`, (el) => ({
  osm_id: osmId(el),
  ref: el.tags?.ref ?? null,
  ...tagNames(el.tags),
  from: el.tags?.from ?? null,
  to: el.tags?.to ?? null,
  operator: el.tags?.operator ?? null,
}));

// Пляжи
await run("beaches.json", `(nwr["natural"="beach"](${B});nwr["leisure"="beach_resort"](${B}););out geom;`, (el) => {
  const c = center(el);
  if (!c) return null;
  return { osm_id: osmId(el), ...tagNames(el.tags), ...c, polygon: polygonOf(el) };
});

// Береговая линия Каспия
await run("coastline.json", `(way["natural"="coastline"](${B}););out geom;`, (el) => ({
  osm_id: osmId(el),
  geometry: { type: "LineString", coordinates: lineOf(el) },
}));

// Промзона и порт (гипотезы источников запаха, раздел 8.2)
await run(
  "industrial.json",
  `(wr["landuse"~"^(industrial|port)$"](${B});nwr["harbour"="yes"](${B});nwr["man_made"~"^(works|wastewater_plant|chimney)$"](${B}););out geom;`,
  (el) => {
    const c = center(el);
    if (!c) return null;
    return {
      osm_id: osmId(el),
      kind: el.tags?.landuse ?? el.tags?.industrial ?? el.tags?.man_made ?? (el.tags?.harbour ? "harbour" : null),
      ...tagNames(el.tags),
      operator: el.tags?.operator ?? null,
      ...c,
      polygon: polygonOf(el),
    };
  }
);

// Здания с адресами — для автоярлыков кластеров («3 мкр, дом 111»)
await run(
  "addresses.json",
  `(nwr["addr:housenumber"](${B}););out center;`,
  (el) => {
    const c = center(el);
    if (!c) return null;
    const t = el.tags ?? {};
    return {
      osm_id: osmId(el),
      street: t["addr:street"] ?? null,
      housenumber: t["addr:housenumber"],
      quarter: t["addr:quarter"] ?? t["addr:suburb"] ?? t["addr:neighbourhood"] ?? null,
      ...c,
    };
  }
);

console.log("Готово.");
