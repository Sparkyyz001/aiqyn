// Импорт РЕАЛЬНЫХ лотов портала госзакупок в procurements (заменяет модельные суммы).
// Источник: data/goszakup-lots.json (собран scripts/goszakup/fetch_lots.py из открытого реестра
// лотов old.goszakup.gov.kz — без авторизации). Берём только закупки со статусом «Закупка состоялась»
// у городских заказчиков Актау и только работы по темам жалоб (дороги, вода, свет, дворы…).
// Сумма — сумма лота по объявлению; лот на несколько микрорайонов делится между ними поровну.
// Берём лоты с даты SINCE (по умолчанию 2024-01-01): сравнивать жалобы последних месяцев
// с деньгами десятилетней давности нечестно.
// Запуск: node --env-file=.env.local scripts/goszakup/import.mjs [--since=2024-01-01]
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { districtCodes } from "./districts.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SINCE = process.argv.find((a) => a.startsWith("--since="))?.slice(8) ?? "2024-01-01";
const lots = JSON.parse(await readFile("data/goszakup-lots.json", "utf8")).filter((l) => l.published && l.published >= SINCE);
const { data: dists, error: dErr } = await db.from("districts").select("id, code, center_lat, center_lng");
if (dErr) throw dErr;
const byCode = new Map(dists.map((d) => [d.code, d]));
const known = new Set(byCode.keys());

const rows = [];
for (const l of lots) {
  const codes = districtCodes(`${l.title} ${l.lot}`, known);
  const parts = codes.length ? codes : [null];
  parts.forEach((code, i) => {
    const d = code ? byCode.get(code) : null;
    rows.push({
      contract_no: parts.length > 1 ? `${l.lot_no} (${i + 1}/${parts.length})` : l.lot_no,
      title: l.title,
      supplier: null, // победитель — в протоколе итогов; в реестре лотов его нет
      customer: l.customer,
      amount_kzt: Math.round((l.amount / parts.length) * 100) / 100,
      signed_at: l.published ?? null,
      district_id: d?.id ?? null,
      lat: d?.center_lat ?? null,
      lng: d?.center_lng ?? null,
      category_hint: l.cat,
      source_url: l.url,
      raw: { source: "goszakup-lots", model: false, lot_no: l.lot_no, announce: l.announce, lot: l.lot, method: l.method, status: l.status, amount_total: l.amount, split: parts.length, districts: codes },
    });
  });
}

const del = await db.from("procurements").delete().gte("id", 0);
if (del.error) throw del.error;
for (let i = 0; i < rows.length; i += 200) {
  const { error } = await db.from("procurements").insert(rows.slice(i, i + 200));
  if (error) throw error;
}
const total = lots.reduce((s, l) => s + l.amount, 0);
console.log(`с ${SINCE} — лотов: ${lots.length}, строк: ${rows.length}, с микрорайоном: ${rows.filter((r) => r.district_id).length}, сумма: ${(total / 1e9).toFixed(1)} млрд тенге`);
