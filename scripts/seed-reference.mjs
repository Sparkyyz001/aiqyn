// Заливка справочников в Supabase из data/*.json (идемпотентно, upsert по code / osm_id).
// Запуск: node scripts/seed-reference.mjs   (нужен SUPABASE_SERVICE_ROLE_KEY в .env.local)
//
// Порядок: services → categories → districts → weather_obs → road_segments → тестовые аккаунты.

import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const json = async (p) => JSON.parse(await readFile(p, "utf8"));

async function upsert(table, rows, onConflict, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + chunk), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length}`);
}

// Службы
const services = (await json("data/services.json")).items;
await upsert(
  "services",
  services.map((s) => ({
    code: s.code,
    short_name: s.short,
    name_ru: s.name_ru,
    name_kz: s.name_kz,
    description: s.description,
    address: s.address,
    contact_phone: s.contact_phone,
    contact_email: s.contact_email,
    verified: s.verified,
    source_url: s.source_url,
  })),
  "code"
);
const { data: svcRows } = await db.from("services").select("id, code");
const svcId = Object.fromEntries(svcRows.map((r) => [r.code, r.id]));

// Категории
const categories = (await json("data/categories.json")).items;
await upsert(
  "categories",
  categories.map((c) => ({
    code: c.code,
    name_ru: c.name_ru,
    name_kz: c.name_kz,
    icon: c.icon,
    default_service: svcId[c.default_service],
    sla_days: c.sla_days,
    severity_base: c.severity_base,
  })),
  "code"
);

// Районы
const districts = (await json("data/districts.normalized.json")).items;
await upsert("districts", districts, "code", 50);

// Погода (почасовая, 90 дней)
const weather = (await json("data/weather_history.json")).items;
await upsert(
  "weather_obs",
  weather.map((w) => ({
    observed_at: new Date(w.t + ":00+05:00").toISOString(), // Asia/Aqtau = UTC+5
    wind_deg: w.wind_deg,
    wind_speed: w.wind_speed,
    temp: w.temp,
  })),
  "observed_at",
  1000
);

// Дорожные сегменты: только именованные и значимые классы (для модуля прогноза)
const roads = (await json("data/road_segments.json")).items.filter(
  (r) => r.geometry.coordinates.length >= 2 && (r.name || ["primary", "secondary", "tertiary", "trunk"].includes(r.highway))
);
await upsert(
  "road_segments",
  roads.map((r) => ({
    osm_id: r.osm_id,
    name: r.name,
    geometry: r.geometry,
    highway_class: r.highway,
  })),
  "osm_id"
);

// Тестовые аккаунты всех ролей (пароли — в README, ТЗ раздел 11)
const DEMO_PASSWORD = "aiqyn2026";
const accounts = [
  { email: "citizen@aiqyn.kz", full_name: "Айгерим Жителева", role: "citizen" },
  { email: "citizen2@aiqyn.kz", full_name: "Ерлан Соседов", role: "citizen" },
  { email: "kzhsa@aiqyn.kz", full_name: "Диспетчер КЖСА", role: "service", service: "kzhsa" },
  { email: "roads@aiqyn.kz", full_name: "Специалист отдела ПТиАД", role: "service", service: "roads" },
  { email: "aues@aiqyn.kz", full_name: "Диспетчер АУЭС", role: "service", service: "aues" },
  { email: "sanitary@aiqyn.kz", full_name: "Диспетчер Zero Waste", role: "service", service: "sanitary" },
  { email: "akimat@aiqyn.kz", full_name: "Аналитик акимата", role: "akimat" },
  { email: "operator@aiqyn.kz", full_name: "Оператор 109", role: "operator" },
];
const { data: existing } = await db.auth.admin.listUsers({ perPage: 1000 });
for (const a of accounts) {
  let user = existing.users.find((u) => u.email === a.email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: a.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: a.full_name },
    });
    if (error) throw new Error(`${a.email}: ${error.message}`);
    user = data.user;
  }
  const { error } = await db
    .from("profiles")
    .update({ role: a.role, service_id: a.service ? svcId[a.service] : null, full_name: a.full_name })
    .eq("id", user.id);
  if (error) throw new Error(`profile ${a.email}: ${error.message}`);
}
console.log(`аккаунты: ${accounts.length} (пароль ${DEMO_PASSWORD})`);
