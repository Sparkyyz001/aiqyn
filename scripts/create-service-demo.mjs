// Демо-аккаунт «Диспетчер городских служб (ЖКХ)»: роль service без привязки к одной службе —
// видит очереди всех служб и получает все новые обращения. Для показа на отдельном телефоне.
// Запуск: node --env-file=.env.local scripts/create-service-demo.mjs
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = "service@aiqyn.kz";
let { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
let user = list.users.find((u) => u.email === email);
if (!user) {
  const { data, error } = await db.auth.admin.createUser({ email, password: "aiqyn2026", email_confirm: true, user_metadata: { full_name: "Диспетчер городских служб" } });
  if (error) throw error;
  user = data.user;
}
const { error } = await db.from("profiles").upsert({ id: user.id, role: "service", service_id: null, full_name: "Диспетчер городских служб (ЖКХ)" });
if (error) throw error;
console.log("готово:", email, user.id);
