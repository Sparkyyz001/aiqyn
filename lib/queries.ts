import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import type { RowReport } from "@/components/reports/report-row";

const SELECT = "id, public_no, title, status, category_id, district_id, sla_due_at, confirmations_count, reopen_count, priority_score, created_at";

type Filter = { serviceId?: number; authorId?: string; ids?: number[]; districtId?: number; statuses?: string[]; limit?: number; source?: string[] };

// Списки обращений для кабинетов (реальные обращения из БД, без демо-подложки)
export async function listReports(f: Filter): Promise<RowReport[]> {
  const db = createAdminClient();
  const ref = await getReference();
  let q = db.from("reports").select(SELECT);
  if (f.serviceId) q = q.eq("service_id", f.serviceId);
  if (f.authorId) q = q.eq("author_id", f.authorId);
  if (f.ids) q = q.in("id", f.ids.length ? f.ids : [-1]);
  if (f.districtId) q = q.eq("district_id", f.districtId);
  if (f.statuses) q = q.in("status", f.statuses);
  if (f.source) q = q.in("source", f.source);
  const { data } = await q.order("priority_score", { ascending: false }).limit(f.limit ?? 300);
  return (data ?? []).map((r) => ({
    id: r.id,
    public_no: r.public_no,
    title: r.title,
    status: r.status,
    category: ref.categoryById.get(r.category_id)?.code ?? "other",
    district: r.district_id ? ref.districtById.get(r.district_id)?.code ?? null : null,
    sla_due_at: r.sla_due_at,
    confirmations_count: r.confirmations_count,
    reopen_count: r.reopen_count,
    priority_score: r.priority_score,
    created_at: r.created_at,
  }));
}
