// Запись модельного потока обращений в базу (is_synthetic = true).
// Запуск: node --env-file=.env.local --import tsx scripts/seed-synthetic.mts
// Повторный запуск заменяет модельные записи (реальные обращения не трогает).
import { createClient } from "@supabase/supabase-js";
import { demoBaseline } from "../lib/demo-baseline";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const [cats, svcs, dists] = await Promise.all([
  db.from("categories").select("id, code"),
  db.from("services").select("id, code"),
  db.from("districts").select("id, code"),
]);
const id = (rows: { id: number; code: string }[] | null, code: string | null) => (code ? rows?.find((x) => x.code === code)?.id ?? null : null);

// Причины задержки у части открытых просроченных (или почти просроченных) модельных обращений:
// у дорог и дворов чаще деньги и закупки, у воды и тепла — материалы и подрядчики.
const hash = (s: string) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 100;
};
const OPEN = ["routed", "accepted", "in_progress", "reopened"];
function delayFor(r: ReturnType<typeof demoBaseline>[number], now: number) {
  if (!OPEN.includes(r.status)) return null;
  if (!(r.sla_breached || new Date(r.sla_due_at).getTime() < now + 3 * 86400_000)) return null;
  if (hash(r.public_no) >= 60) return null;
  const h = hash(r.public_no + "r");
  const reason = ["road_pit", "excavation", "yard", "lighting", "beach"].includes(r.category)
    ? h < 45 ? "no_funding" : h < 70 ? "procurement" : h < 82 ? "contractor" : h < 92 ? "materials" : "weather"
    : ["water_outage", "sewage", "heating", "power_outage"].includes(r.category)
      ? h < 15 ? "no_funding" : h < 30 ? "procurement" : h < 60 ? "materials" : h < 85 ? "contractor" : "other_org"
      : h < 20 ? "no_funding" : h < 35 ? "procurement" : h < 55 ? "contractor" : h < 70 ? "other_org" : "materials";
  const at = Math.min(now - 6 * 3600_000, new Date(r.accepted_at ?? r.created_at).getTime() + 3 * 86400_000);
  return { delay_reason: reason, delay_at: new Date(at).toISOString() };
}

const list = demoBaseline();
const nowMs = Date.now();
const rows = list.map((r) => ({
  public_no: r.public_no,
  is_synthetic: true,
  author_id: null,
  category_id: id(cats.data, r.category) ?? id(cats.data, "other"),
  service_id: id(svcs.data, r.service),
  district_id: id(dists.data, r.district),
  title: r.title,
  title_kz: r.title_kz,
  lat: r.lat,
  lng: r.lng,
  status: r.status,
  priority_score: r.priority,
  confirmations_count: r.confirmations,
  reopen_count: r.reopen_count,
  sla_due_at: r.sla_due_at,
  sla_breached_at: r.sla_breached ? r.sla_due_at : null,
  source: r.source,
  created_at: r.created_at,
  accepted_at: r.accepted_at,
  resolved_at: r.resolved_at,
  closed_at: r.status === "resolved" || r.status === "rejected" ? r.resolved_at : null,
  synthetic: { after_geo_verified: r.after_geo_verified, reply_boilerplate: r.reply_boilerplate },
  delay_reason: null as string | null,
  delay_at: null as string | null,
  ...delayFor(r, nowMs),
}));

const missing = rows.filter((r) => !r.category_id || !r.service_id);
if (missing.length) throw new Error(`нет справочника для ${missing.length} записей: ${missing.slice(0, 3).map((r) => r.public_no).join(", ")}`);

const del = await db.from("reports").delete().eq("is_synthetic", true);
if (del.error) throw del.error;
for (let i = 0; i < rows.length; i += 200) {
  const { error } = await db.from("reports").insert(rows.slice(i, i + 200));
  if (error) throw error;
}
const { count } = await db.from("reports").select("*", { count: "exact", head: true }).eq("is_synthetic", true);
console.log(`модельных обращений в базе: ${count} (сгенерировано ${rows.length})`);
