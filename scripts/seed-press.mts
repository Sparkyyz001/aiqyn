// Импорт реальных кейсов из местных СМИ как обращений (источник — «оператор», ссылка на статью).
// Запуск: npx tsx scripts/seed-press.mts
//
// Честность данных:
//  - дата создания = дата публикации статьи (проверена по странице первоисточника);
//  - координаты — адресная точка OSM для указанного в статье дома;
//  - никаких выдуманных действий служб: только «создано оператором» и «передано службе».
//    Если срок по АППК с даты публикации истёк — обращение честно просрочено.
// Идемпотентно: повторный запуск не создаёт дублей (ищет по source_url).

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { slaDueAt } from "../lib/sla.ts";

config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

type Case = {
  title: string; description: string; category: string; service: string; district: string;
  lat: number; lng: number; address: string; published: string; url: string;
};

const CASES: Case[] = [
  {
    title: "3 мкр, дом 111: почти год не восстанавливают асфальт после раскопок КЖСА",
    description: "Жители дома №111 в 3 мкр почти год не могут добиться от ГКП «КЖСА» восстановления асфальта: покрытие вскрыли повторно для аварийных работ и не восстановили. Заведено оператором по публикации lada.kz.",
    category: "excavation", service: "kzhsa", district: "mkr-3",
    lat: 43.636106, lng: 51.174662, address: "3 мкр, дом 111",
    published: "2026-04-01T12:05:00+05:00",
    url: "https://www.lada.kz/aktau_news/communal/151311-zhiteli-aktau-god-ne-mogut-dobitsia-vosstanovleniia-asfalta-posle-remonta-kzhsa.html",
  },
  {
    title: "15 мкр, дома 64, 64А, 66, 66А: разбитая дорога внутри квартала",
    description: "Ямы, просадки, разрушенное покрытие у домов 64, 64А, 66, 66А. Заведено оператором по публикации lada.kz.",
    category: "road_pit", service: "roads", district: "mkr-15",
    lat: 43.659957, lng: 51.139315, address: "15 мкр, дома 64–66А",
    published: "2026-08-21T12:12:00+05:00",
    url: "https://www.lada.kz/aktau_news/society/157060-to-pogoda-ne-ta-to-deneg-net-zhiteli-aktau-vozmushcheny-razbitoi-dorogoi-vnutri-mikroraiona.html",
  },
  {
    title: "3 мкр, дом 146: несколько дней вместо питьевой воды шла техническая",
    description: "По публикации newsroom.kz: жители сообщили, что несколько дней нет питьевой воды, в доме №146 3 мкр четыре дня из кранов шла техническая. Заведено оператором.",
    category: "water_outage", service: "kzhsa", district: "mkr-3",
    lat: 43.6355686, lng: 51.1758426, address: "3 мкр, дом 146",
    published: "2026-09-17T12:00:00+05:00",
    url: "https://ru.newsroom.kz/87817/zhaloby-zhiteley-aktau-na-vodu-chto-otvetilo-ministerstvo",
  },
];

const { data: op } = await db.from("profiles").select("id").eq("role", "operator").limit(1).single();
const [{ data: cats }, { data: svcs }, { data: dists }] = await Promise.all([
  db.from("categories").select("id, code, sla_days, severity_base"),
  db.from("services").select("id, code, short_name"),
  db.from("districts").select("id, code"),
]);
const by = <T extends { code: string }>(xs: T[] | null, code: string) => xs!.find((x) => x.code === code)!;

for (const c of CASES) {
  const { data: exists } = await db.from("reports").select("public_no").eq("source_url", c.url).maybeSingle();
  if (exists) {
    console.log(`уже есть: ${exists.public_no}`);
    continue;
  }
  const cat = by(cats, c.category), svc = by(svcs, c.service), dist = by(dists, c.district);
  const created = new Date(c.published);
  const due = slaDueAt(created, cat.sla_days);
  const breached = due < new Date() ? due.toISOString() : null;
  const { data: r, error } = await db
    .from("reports")
    .insert({
      author_id: op!.id, category_id: cat.id, service_id: svc.id, district_id: dist.id,
      title: c.title, description: c.description, lat: c.lat, lng: c.lng, address_text: c.address,
      status: "routed", severity: cat.severity_base, sla_due_at: due.toISOString(), sla_breached_at: breached,
      source: "operator", source_url: c.url, created_at: created.toISOString(),
      priority_score: cat.severity_base + (breached ? 30 : 0),
    })
    .select("id, public_no")
    .single();
  if (error) throw error;
  await db.from("report_events").insert([
    { report_id: r.id, actor_id: op!.id, type: "created", to_status: "new", created_at: created.toISOString(), comment: "Заведено оператором по публикации СМИ", meta: { source: "press", source_url: c.url } },
    { report_id: r.id, actor_id: null, type: "routed", from_status: "new", to_status: "routed", created_at: created.toISOString(), comment: `${svc.short_name}: служба по категории`, meta: { service: svc.code, rule: null } },
  ]);
  console.log(`${r.public_no}: ${c.address} · срок ${due.toISOString().slice(0, 10)}${breached ? " · ПРОСРОЧЕНО" : ""}`);
}
