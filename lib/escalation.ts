import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";

// Пакет эскалации в eOtinish (ТЗ, 6.7). Мы НЕ отправляем обращение в госсистему —
// готовим структурированный пакет с доказательной базой, подаёт сам житель на eotinish.kz.

export type EscalationPayload = {
  report_no: string;
  public_url: string;
  applicant: { full_name: string; contact: string | null };
  title: string;
  description: string | null;
  address: string;
  coords: { lat: number; lng: number };
  category: string;
  district: string | null;
  service: { name: string; address: string | null; phone: string | null; verified: boolean; source_url: string | null };
  created_at: string;
  sla_due_at: string | null;
  sla_breached_at: string | null;
  reopen_count: number;
  confirmations: number;
  photos: { kind: string; url: string; geo_verified: boolean; taken_at: string | null }[];
  timeline: { at: string; what: string; comment: string | null }[];
  legal_basis: string[];
  generated_at: string;
};

const STATUS: Record<string, string> = {
  new: "Новое", routed: "Передано службе", accepted: "Принято", in_progress: "В работе",
  awaiting_confirmation: "Ждёт подтверждения жителей", resolved: "Решено", rejected: "Отклонено", reopened: "Переоткрыто",
};

export async function buildEscalationPayload(reportId: number, applicant: { full_name: string; contact: string | null }, origin: string): Promise<EscalationPayload | null> {
  const db = createAdminClient();
  const ref = await getReference();
  const [{ data: r }, { data: events }, { data: photos }] = await Promise.all([
    db.from("reports").select("*").eq("id", reportId).single(),
    db.from("report_events").select("created_at, type, from_status, to_status, comment, meta").eq("report_id", reportId).order("created_at"),
    db.from("report_photos").select("kind, url, geo_verified, taken_at").eq("report_id", reportId).order("created_at"),
  ]);
  if (!r) return null;
  const svc = r.service_id ? ref.serviceById.get(r.service_id) : null;
  const cat = ref.categoryById.get(r.category_id);
  const district = r.district_id ? ref.districtById.get(r.district_id) : null;

  const what = (e: { type: string; from_status: string | null; to_status: string | null; meta: Record<string, unknown> | null }) => {
    if (e.to_status) return `${e.from_status ? STATUS[e.from_status] + " → " : ""}${STATUS[e.to_status]}`;
    return (
      ({ confirmed: "Житель подтвердил проблему", reply: "Ответ службы", escalated: "Сформирован пакет эскалации", incident_linked: "Привязано к аварии" } as Record<string, string>)[e.type] ??
      (e.type === "verification" ? (e.meta?.verdict === "fixed" ? "Житель: сделано" : "Житель: НЕ сделано") : e.type)
    );
  };

  return {
    report_no: r.public_no,
    public_url: `${origin}/report/${r.public_no}`,
    applicant,
    title: r.title,
    description: r.description,
    address: r.address_text ?? `${district?.name_ru ?? "Актау"}`,
    coords: { lat: r.lat, lng: r.lng },
    category: cat?.name_ru ?? "",
    district: district?.name_ru ?? null,
    service: {
      name: svc?.name_ru ?? "—",
      address: svc?.address ?? null,
      phone: svc?.contact_phone ?? null,
      verified: svc?.verified ?? false,
      source_url: svc?.source_url ?? null,
    },
    created_at: r.created_at,
    sla_due_at: r.sla_due_at,
    sla_breached_at: r.sla_breached_at,
    reopen_count: r.reopen_count,
    confirmations: r.confirmations_count,
    photos: photos ?? [],
    timeline: (events ?? []).map((e) => ({ at: e.created_at, what: what(e), comment: e.comment })),
    legal_basis: [
      "Административный процедурно-процессуальный кодекс РК, ст. 76 — срок рассмотрения обращения 15 рабочих дней",
      "АППК РК, ст. 99 — срок рассмотрения жалобы 20 рабочих дней",
    ],
    generated_at: new Date().toISOString(),
  };
}

const d = (s: string | null) =>
  s ? new Date(s).toLocaleString("ru-RU", { timeZone: "Asia/Aqtau", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/** Текст обращения для вставки в форму eOtinish */
export function escalationText(p: EscalationPayload): string {
  const lines = [
    `Жалоба на нарушение срока рассмотрения обращения ${p.report_no}`,
    "",
    `Заявитель: ${p.applicant.full_name}${p.applicant.contact ? `, ${p.applicant.contact}` : ""}`,
    `Суть: ${p.title}${p.description ? `. ${p.description}` : ""}`,
    `Категория: ${p.category}`,
    `Адрес: ${p.address}; координаты ${p.coords.lat.toFixed(6)}, ${p.coords.lng.toFixed(6)}`,
    `Ответственная организация: ${p.service.name}${p.service.address ? `, ${p.service.address}` : ""}`,
    "",
    `Обращение зарегистрировано ${d(p.created_at)}. Срок рассмотрения по ст. 76 АППК РК — до ${d(p.sla_due_at)}.`,
    p.sla_breached_at ? `Срок нарушен с ${d(p.sla_breached_at)}.` : "",
    p.reopen_count ? `Служба сообщала о выполнении, но жители опровергли это ${p.reopen_count} раз(а).` : "",
    `Проблему подтвердили ${p.confirmations} жителей.`,
    "",
    "Хронология:",
    ...p.timeline.map((t) => `• ${d(t.at)} — ${t.what}${t.comment ? `: ${t.comment}` : ""}`),
    "",
    `Фото и полная хронология: ${p.public_url}`,
    "",
    "Прошу рассмотреть жалобу, обеспечить устранение проблемы и сообщить конкретный срок и исполнителя.",
  ];
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}
