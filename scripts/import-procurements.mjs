// Импорт РЕАЛЬНЫХ контрактов по благоустройству/дорогам/ЖКХ Актау в таблицу procurements.
// Запуск: node scripts/import-procurements.mjs data/procurements.csv
//
// Откуда CSV: goszakup.gov.kz → Реестр договоров → фильтр по заказчику/региону (Мангистауская обл., Актау)
// и предмету (благоустройство, дороги, ЖКХ) → выгрузка. Номера и суммы — только из портала, не выдумываются.
// Когда ЦЭФ выдаст токен OWS, эту же таблицу будет заполнять запрос к ows.goszakup.gov.kz.
//
// Ожидаемые колонки (заголовки, регистр неважен; разделитель , или ;):
//   contract_no, title, supplier, customer, amount_kzt, signed_at (YYYY-MM-DD или DD.MM.YYYY), source_url
// Геопривязка: по упоминанию микрорайона в предмете закупки («3 мкр», «15 микрорайон», «Шыгыс-2»).

import { readFile, writeFile } from "node:fs/promises";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
const file = process.argv[2];
if (!file) {
  console.error("Укажите CSV: node scripts/import-procurements.mjs data/procurements.csv");
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const text = (await readFile(file, "utf8")).replace(/^﻿/, "");
const sep = text.split("\n")[0].includes(";") ? ";" : ",";
function parseLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === sep && !q) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}
const [head, ...rows] = text.split(/\r?\n/).filter(Boolean).map(parseLine);
const idx = Object.fromEntries(head.map((h, i) => [h.toLowerCase().trim(), i]));
const col = (r, k) => (idx[k] != null ? r[idx[k]] : "");

const { data: districts } = await db.from("districts").select("id, code, name_ru, name_kz, center_lat, center_lng");
function districtFor(title) {
  const t = title.toLowerCase();
  const m = t.match(/(\d{1,2}[а-яa-z]?)\s*(?:-?\s*(?:й|го|ом)?\s*)?(?:мкр|микрорайон|шағын)/i);
  if (m) {
    const d = districts.find((d) => d.name_ru.toLowerCase() === `${m[1]} мкр`);
    if (d) return d;
  }
  return districts.find((d) => d.name_ru.length > 3 && !/^\d/.test(d.name_ru) && t.includes(d.name_ru.replace(/ мкр$/, "").toLowerCase())) ?? null;
}
const date = (s) => {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s.slice(0, 10) || null;
};
const hint = (t) => (/дорог|асфальт|тротуар/i.test(t) ? "roads" : /благоустр|двор|озелен/i.test(t) ? "yard" : /вод|канализ|тепл/i.test(t) ? "utilities" : /освещ/i.test(t) ? "lighting" : null);

const items = rows
  .map((r) => {
    const title = col(r, "title");
    const url = col(r, "source_url");
    if (!title || !url) return null; // без ссылки на первоисточник не импортируем
    const d = districtFor(title);
    return {
      contract_no: col(r, "contract_no") || null,
      title,
      supplier: col(r, "supplier") || null,
      customer: col(r, "customer") || null,
      amount_kzt: Number(col(r, "amount_kzt").replace(/[\s ]/g, "").replace(",", ".")) || null,
      signed_at: date(col(r, "signed_at")),
      district_id: d?.id ?? null,
      lat: d?.center_lat ?? null,
      lng: d?.center_lng ?? null,
      category_hint: hint(title),
      source_url: url,
      raw: Object.fromEntries(head.map((h, i) => [h, r[i]])),
    };
  })
  .filter(Boolean);

await db.from("procurements").delete().neq("id", 0);
for (let i = 0; i < items.length; i += 200) {
  const { error } = await db.from("procurements").insert(items.slice(i, i + 200));
  if (error) throw error;
}
await writeFile("data/procurements.json", JSON.stringify({ source: "goszakup.gov.kz, ручная выгрузка", imported_at: new Date().toISOString(), items }, null, 1));
console.log(`импортировано ${items.length}, с привязкой к району: ${items.filter((i) => i.district_id).length}`);
