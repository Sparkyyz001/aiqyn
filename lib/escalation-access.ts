import { msg } from "@/lib/i18n/server";
import "server-only";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Эскалация доступна при нарушенном сроке или от двух переоткрытий (ТЗ, 6.7).
// Инициировать могут автор, подтвердившие жители и сотрудники (служба/акимат/оператор).
export async function checkEscalation(reportId: number) {
  const me = await getProfile();
  if (!me) return { ok: false as const, error: await msg("login") };
  const db = createAdminClient();
  const { data: r } = await db.from("reports").select("id, author_id, service_id, sla_breached_at, reopen_count, status, public_no").eq("id", reportId).single();
  if (!r) return { ok: false as const, error: await msg("notFound") };
  if (!(r.sla_breached_at || r.reopen_count >= 2)) return { ok: false as const, error: await msg("escalateNotYet") };
  const { count } = await db.from("report_confirmations").select("id", { count: "exact", head: true }).eq("report_id", r.id).eq("user_id", me.id);
  const involved = r.author_id === me.id || (count ?? 0) > 0 || ["akimat", "operator"].includes(me.role) || (me.role === "service" && (me.service_id == null || me.service_id === r.service_id));
  if (!involved) return { ok: false as const, error: await msg("escalateWho") };
  return { ok: true as const, me, r };
}

