"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { pointInPolygon, type GeoPolygon } from "@/lib/geo";
import { logEvent, recomputeReport } from "@/lib/report-engine";
import { VOTING_WINDOW_H } from "@/lib/verification";
import { INCIDENT_CATEGORIES } from "@/lib/incidents";

// ФИШКА 5: режим аварии. Зона = объединение полигонов выбранных микрорайонов (OSM).
// Обращения подходящей категории внутри зоны автоматически привязываются к аварии —
// житель сразу видит «Известная авария, восстановление до …», очередь не плодится.


type Input = { type: string; title: string; description?: string; serviceCode: string; districtIds: number[]; eta_at?: string | null };

async function staff() {
  const me = await getProfile();
  if (!me || !["operator", "akimat", "service"].includes(me.role)) return null;
  return me;
}

function unionPolygon(polys: GeoPolygon[]): GeoPolygon {
  const coords = polys.flatMap((p) => (p.type === "Polygon" ? [p.coordinates] : p.coordinates));
  return { type: "MultiPolygon", coordinates: coords };
}

export async function createIncident(input: Input) {
  const me = await staff();
  if (!me) return { ok: false as const, error: "Нет прав" };
  if (!INCIDENT_CATEGORIES[input.type]) return { ok: false as const, error: "Неизвестный тип аварии" };
  if (!input.title?.trim() || !input.districtIds.length) return { ok: false as const, error: "Укажите название и зону" };

  const ref = await getReference();
  const polys = input.districtIds.map((id) => ref.districtById.get(id)?.polygon).filter(Boolean) as GeoPolygon[];
  if (!polys.length) return { ok: false as const, error: "У выбранных районов нет границ" };
  const polygon = unionPolygon(polys);
  const svc = ref.serviceByCode.get(input.serviceCode);

  const db = createAdminClient();
  const { data: inc, error } = await db
    .from("incidents")
    .insert({
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      service_id: svc?.id ?? null,
      polygon,
      eta_at: input.eta_at || null,
      created_by: me.id,
    })
    .select("id, title, eta_at")
    .single();
  if (error || !inc) return { ok: false as const, error: error?.message ?? "Ошибка" };

  // Привязываем уже открытые обращения в зоне
  const catIds = INCIDENT_CATEGORIES[input.type].map((c) => ref.categoryByCode.get(c)?.id).filter(Boolean) as number[];
  const { data: open } = await db
    .from("reports")
    .select("id, lat, lng")
    .in("category_id", catIds)
    .in("status", ["new", "routed", "accepted", "in_progress", "reopened"])
    .is("incident_id", null);
  const inside = (open ?? []).filter((r) => pointInPolygon(r, polygon));
  if (inside.length) {
    await db.from("reports").update({ incident_id: inc.id }).in("id", inside.map((r) => r.id));
    for (const r of inside)
      await logEvent({ report_id: r.id, actor_id: me.id, type: "incident_linked", comment: `Известная авария: ${inc.title}`, meta: { incident_id: inc.id, eta_at: inc.eta_at } });
  }
  revalidatePath("/incidents");
  revalidatePath("/map");
  return { ok: true as const, data: { id: inc.id, linked: inside.length } };
}

/** Закрытие аварии: связанные обращения уходят жителям на подтверждение (тот же механизм, 72 ч) */
export async function resolveIncident(id: number) {
  const me = await staff();
  if (!me) return { ok: false as const, error: "Нет прав" };
  const db = createAdminClient();
  const now = new Date();
  await db.from("incidents").update({ status: "resolved", resolved_at: now.toISOString() }).eq("id", id);
  const { data: linked } = await db
    .from("reports")
    .select("id, status")
    .eq("incident_id", id)
    .in("status", ["new", "routed", "accepted", "in_progress", "reopened"]);
  const due = new Date(now.getTime() + VOTING_WINDOW_H * 3600_000).toISOString();
  for (const r of linked ?? []) {
    await db.from("reports").update({ status: "awaiting_confirmation", verification_due_at: due }).eq("id", r.id);
    await logEvent({
      report_id: r.id, actor_id: me.id, type: "status_change", from_status: r.status, to_status: "awaiting_confirmation",
      comment: "Авария устранена — подтвердите, что у вас всё восстановлено", meta: { incident_id: id, voting_until: due },
    });
    await recomputeReport(r.id);
  }
  revalidatePath("/incidents");
  return { ok: true as const, data: { closed: linked?.length ?? 0 } };
}
