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

const list = demoBaseline();
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
