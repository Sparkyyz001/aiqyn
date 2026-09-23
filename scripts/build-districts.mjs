// Нормализация микрорайонов из OSM (data/districts.json) → data/districts.normalized.json
// Запуск: node scripts/build-districts.mjs
//
// Что делает:
//  1. Склеивает дубли: в OSM один микрорайон часто есть и точкой (node), и полигоном (way).
//     Приоритет — полигону.
//  2. Даёт стабильный code: mkr-3a, mkr-15, samal, shygys-1 ...
//  3. Нормализует названия: «3А шағын ауданы» → ru «3А мкр», kz «3А шағын ауданы».
//     Русские названия НЕ берём из тега name:ru — там есть ошибки
//     (у полигона «13 шағын аудан» name:ru = «15 шағын аудан»).
//  4. Отбрасывает мысы и прочее, что не является жилым районом.

import { readFile, writeFile } from "node:fs/promises";

const src = JSON.parse(await readFile("data/districts.json", "utf8"));

const KZ2RU = { ә: "а", ғ: "г", қ: "к", ң: "н", ө: "о", ұ: "у", ү: "у", һ: "х", і: "и",
  Ә: "А", Ғ: "Г", Қ: "К", Ң: "Н", Ө: "О", Ұ: "У", Ү: "У", Һ: "Х", І: "И" };
const kzToRu = (s) => s.replace(/[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/g, (c) => KZ2RU[c]);

const LAT = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
const slug = (s) =>
  kzToRu(s.toLowerCase())
    .replace(/[а-я]/g, (c) => LAT[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Номер микрорайона: «3А шағын ауданы», «12 микрорайон», «микрорайон 31Б», «38-й микрорайон»
function parseMkr(name) {
  const m =
    name.match(/^(\d+[А-ЯA-Z]?)(?:-й|-ші)?\s+(?:шағын аудан|микрорайон)/i) ??
    name.match(/^микрорайон\s+(\d+[А-ЯA-Z]?)$/i);
  return m ? m[1].toUpperCase() : null;
}

// Именованные районы: убираем служебные слова
function cleanNamed(name) {
  return name
    .replace(/\s*(шағын ауданы|шағын аудан|микрорайон|тұрғын ауданы)\s*$/i, "")
    .replace(/^(жилой массив|квартал|микрорайон)\s+/i, "")
    .trim();
}

const SKIP = /мыс|cape|автодром/i;

// Ручные русские названия там, где транслитерация с казахского звучит неестественно
const RU_OVERRIDE = {
  "4-shi-industriyalyk-aymak": "4-я индустриальная зона",
  "22-shi-toksany": "22-й квартал",
  besshoky: "Бесшокы",
};
const out = new Map();

for (const d of src.items) {
  const name = d.name ?? d.name_ru;
  if (!name || SKIP.test(name)) continue;

  let code, name_ru, name_kz, kind;
  const num = parseMkr(name);
  if (num) {
    code = "mkr-" + slug(num);
    name_ru = `${num} мкр`;
    name_kz = `${num} шағын аудан${/[А-Я]$/.test(num) ? "ы" : ""}`;
    kind = "mkr";
  } else {
    const base = cleanNamed(name);
    const isZone = /пром|индустр|өнеркәсіп/i.test(name);
    kind = isZone ? "zone" : d.place === "village" || d.place === "suburb" ? "village" : "mkr";
    code = slug(base);
    name_kz = d.name_kz ?? base;
    const ruBase = kzToRu(base);
    // «мкр» добавляем только если в оригинале было «шағын аудан» / «микрорайон»
    name_ru = /шағын аудан|микрорайон/i.test(name) ? `${ruBase} мкр` : ruBase;
    if (/ж\/к/i.test(base)) name_ru = name_kz = `ЖК ${base.replace(/\s*ж\/к/i, "")}`;
  }
  // Бешоқы / Бесшоқы — одно и то же село, разные написания в OSM
  if (code === "beshoky") code = "besshoky";
  if (RU_OVERRIDE[code]) name_ru = RU_OVERRIDE[code];
  if (code === "22-shi-toksany") kind = "mkr";

  const prev = out.get(code);
  const better = !prev || (!prev.polygon && d.polygon);
  if (!better) continue;
  out.set(code, {
    code,
    name_ru,
    name_kz,
    kind,
    center_lat: +d.lat.toFixed(6),
    center_lng: +d.lng.toFixed(6),
    polygon: d.polygon ?? prev?.polygon ?? null,
    population: d.population ?? null,
    osm_id: d.osm_id,
  });
}

const items = [...out.values()].sort((a, b) => {
  const na = parseInt(a.name_ru), nb = parseInt(b.name_ru);
  if (!isNaN(na) && !isNaN(nb)) return na - nb || a.name_ru.localeCompare(b.name_ru);
  if (!isNaN(na)) return -1;
  if (!isNaN(nb)) return 1;
  return a.name_ru.localeCompare(b.name_ru, "ru");
});

await writeFile(
  "data/districts.normalized.json",
  JSON.stringify({ source: "data/districts.json (OSM, ODbL) → scripts/build-districts.mjs", items }, null, 1)
);
console.log(`${items.length} районов, с полигоном: ${items.filter((i) => i.polygon).length}`);
console.log(items.map((i) => `${i.code}:${i.name_ru}/${i.name_kz}${i.polygon ? "" : " (без полигона)"}`).join("\n"));
