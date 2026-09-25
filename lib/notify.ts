import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { DICTS, fmt } from "@/lib/i18n/dict";
import { flow } from "@/lib/data";
import { honestContext, honestForecast } from "@/lib/honest-deadline";

// Уведомления по событиям обращения. Вызывается из logEvent — каждое событие в хронологии
// само рассылается тем, кого касается:
//   житель (автор и подтвердившие) — принято + честный прогноз, ответ службы, смена статуса, итог;
//   служба — новые обращения, адресованные ей (и «диспетчер городских служб» — всех служб), риск срыва,
//     переоткрытие, жалоба в eOtinish; оператор 109 — весь входящий поток;
//   акимат — не каждое обращение, а движение: какая служба взялась, выполнила, отклонила, задержка,
//     риск срыва, переоткрытие, eOtinish.
// Тексты пишутся сразу на двух языках: интерфейс показывает нужный.

type Ev = { report_id: number; actor_id: string | null; type: string; to_status?: string | null; comment?: string | null; meta?: Record<string, unknown> | null };
type Row = { user_id: string; report_id: number; kind: string; title: string; title_kz: string; body: string | null; body_kz: string | null; link: string; tone: "info" | "ok" | "warn" | "danger" };

const RU = DICTS.ru.notify;
const KZ = DICTS.kz.notify;
const date = (iso: string, lang: "ru" | "kz") => new Date(iso).toLocaleDateString(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Aqtau" });

export async function notifyEvent(e: Ev) {
  const db = createAdminClient();
  const { data: r } = await db
    .from("reports")
    .select("id, public_no, title, author_id, service_id, category_id, district_id, status, created_at, resolved_at, sla_due_at, confirmations_count")
    .eq("id", e.report_id)
    .single();
  if (!r) return;
  const ref = await getReference();
  const svc = r.service_id ? ref.serviceById.get(r.service_id) : null;
  const cat = ref.categoryById.get(r.category_id);
  const dist = r.district_id ? ref.districtById.get(r.district_id) : null;
  const link = `/report/${r.public_no}`;
  const no = r.public_no;
  const rows: Row[] = [];

  // тому, кто сам совершил действие, не шлём (кроме подтверждения подачи — его автор ждёт)
  const push = (users: (string | null | undefined)[], kind: string, tone: Row["tone"], ru: [string, string | null], kz: [string, string | null], toActor = false) => {
    for (const u of new Set(users.filter((x): x is string => !!x && (toActor || x !== e.actor_id))))
      rows.push({ user_id: u, report_id: r.id, kind, tone, title: ru[0], body: ru[1], title_kz: kz[0], body_kz: kz[1], link });
  };

  // адресаты среди сотрудников
  const people = async () => (await db.from("profiles").select("id, role, service_id").in("role", ["akimat", "operator", "service"])).data ?? [];
  const service = async () => (await people()).filter((p) => p.role === "service" && (p.service_id == null || p.service_id === r.service_id)).map((p) => p.id);
  const operators = async () => (await people()).filter((p) => p.role === "operator").map((p) => p.id);
  const akimat = async () => (await people()).filter((p) => p.role === "akimat").map((p) => p.id);
  const staff = async () => [...(await service()), ...(await akimat())];
  // кого из жителей: автор и все, кто подтвердил проблему
  const citizens = async () => {
    const { data } = await db.from("report_confirmations").select("user_id").eq("report_id", r.id);
    return [r.author_id, ...(data ?? []).map((c) => c.user_id)];
  };

  const svcName = (lang: "ru" | "kz") => (svc ? (lang === "kz" ? svc.name_kz ?? svc.name_ru : svc.name_ru) : "—");
  const catName = (lang: "ru" | "kz") => (cat ? (lang === "kz" ? cat.name_kz ?? cat.name_ru : cat.name_ru) : "");
  const distName = (lang: "ru" | "kz") => (dist ? (lang === "kz" ? dist.name_kz ?? dist.name_ru : dist.name_ru) : "Актау");

  if (e.type === "created") {
    // честный прогноз — и жителю (правда о сроках сразу), и акимату (раннее предупреждение)
    const { all } = await flow();
    const f = honestForecast(
      { id: r.id, category: cat?.code ?? "other", service: svc?.code ?? "akimat", district: dist?.code ?? null, status: r.status, created_at: r.created_at, resolved_at: r.resolved_at, sla_due_at: r.sla_due_at },
      honestContext(all)
    );
    const risky = f.ok && (f.pBreach ?? 0) >= 0.5;
    const citizenBody = (d: typeof RU, lang: "ru" | "kz") =>
      fmt(d.acceptedBody, { service: svcName(lang), due: r.sla_due_at ? date(r.sla_due_at, lang) : "—" }) +
      (f.ok ? fmt(d.forecastBody, { date: date(f.date, lang), lo: date(f.lo, lang), hi: date(f.hi, lang) }) : "") +
      (risky ? fmt(d.forecastRisk, { p: Math.round((f as { pBreach: number }).pBreach * 100) }) : "");
    push([r.author_id], "accepted", risky ? "warn" : "ok", [fmt(RU.acceptedTitle, { no }), citizenBody(RU, "ru")], [fmt(KZ.acceptedTitle, { no }), citizenBody(KZ, "kz")], true);

    const newBody = (d: typeof RU, lang: "ru" | "kz") => fmt(d.newBody, { title: r.title, cat: catName(lang), district: distName(lang), service: svcName(lang) });
    push([...(await service()), ...(await operators())], "new", "info", [fmt(RU.newTitle, { no }), newBody(RU, "ru")], [fmt(KZ.newTitle, { no }), newBody(KZ, "kz")]);
    if (risky && f.ok) {
      const p = Math.round((f.pBreach ?? 0) * 100);
      push(await staff(), "risk", "warn", [fmt(RU.riskTitle, { no }), fmt(RU.riskBody, { p, date: date(f.date, "ru") })], [fmt(KZ.riskTitle, { no }), fmt(KZ.riskBody, { p, date: date(f.date, "kz") })]);
    }
  } else if (e.type === "incident_linked") {
    const eta = typeof e.meta?.eta_at === "string" ? (e.meta.eta_at as string) : null;
    const title = String(e.meta?.title ?? "");
    push([r.author_id], "incident", "info",
      [RU.incidentTitle, fmt(RU.incidentBody, { title, eta: eta ? fmt(RU.etaPart, { eta: date(eta, "ru") }) : "" })],
      [KZ.incidentTitle, fmt(KZ.incidentBody, { title, eta: eta ? fmt(KZ.etaPart, { eta: date(eta, "kz") }) : "" })]);
  } else if (e.type === "status_change" && e.to_status) {
    const key = `status_${e.to_status}` as keyof typeof RU;
    if (!(key in RU)) return;
    const tone: Row["tone"] = e.to_status === "rejected" ? "danger" : e.to_status === "resolved" ? "ok" : e.to_status === "awaiting_confirmation" ? "warn" : "info";
    const body = (d: typeof RU) => (e.to_status === "awaiting_confirmation" ? d.awaitingBody : e.comment ?? null);
    push(await citizens(), e.to_status, tone, [fmt(RU[key] as string, { no }), body(RU)], [fmt(KZ[key] as string, { no }), body(KZ)]);
    const akKey = `ak_${e.to_status}` as keyof typeof RU;
    if (akKey in RU) {
      const akBody = (d: typeof RU, lang: "ru" | "kz") => fmt(d.akBody, { title: r.title, district: distName(lang) });
      push(await akimat(), `ak_${e.to_status}`, tone,
        [fmt(RU[akKey] as string, { no, service: svc?.short_name ?? svcName("ru") }), akBody(RU, "ru")],
        [fmt(KZ[akKey] as string, { no, service: svc?.short_name ?? svcName("kz") }), akBody(KZ, "kz")]);
    }
  } else if (e.type === "reply") {
    const text = (e.comment ?? "").slice(0, 200);
    push(await citizens(), "reply", "info", [fmt(RU.replyTitle, { no }), text], [fmt(KZ.replyTitle, { no }), text]);
  } else if (e.type === "reopened") {
    push([...(await citizens()), ...(await staff())], "reopened", "danger", [fmt(RU.reopenedTitle, { no }), RU.reopenedBody], [fmt(KZ.reopenedTitle, { no }), KZ.reopenedBody]);
  } else if (e.type === "confirmed") {
    const n = r.confirmations_count;
    push([r.author_id], "confirmed", "info", [fmt(RU.confirmedTitle, { no }), fmt(RU.confirmedBody, { n })], [fmt(KZ.confirmedTitle, { no }), fmt(KZ.confirmedBody, { n })]);
  } else if (e.type === "delay_reason" && e.meta?.msg === "delay_set") {
    // служба объяснила задержку — жителю и акимату (денежные причины — вопрос бюджета)
    const reason = String(e.meta?.reason ?? "");
    const rl = (lang: "ru" | "kz") => (DICTS[lang].card.delayReasons as Record<string, string>)[reason] ?? reason;
    push([...(await citizens()), ...(await akimat())], "delay", "warn",
      [fmt(RU.delayTitle, { no, service: svc?.short_name ?? "" }), `${rl("ru")}${e.comment ? ` — ${e.comment}` : ""}`],
      [fmt(KZ.delayTitle, { no, service: svc?.short_name ?? "" }), `${rl("kz")}${e.comment ? ` — ${e.comment}` : ""}`]);
  } else if (e.type === "escalated") {
    push(await staff(), "escalated", "danger", [fmt(RU.escalatedTitle, { no }), RU.escalatedBody], [fmt(KZ.escalatedTitle, { no }), KZ.escalatedBody]);
  }

  if (rows.length) {
    await db.from("notifications").insert(rows);
    // тот же текст — push на телефон (если пользователь включил уведомления)
    try {
      const { sendPush } = await import("@/lib/push");
      await sendPush(rows);
    } catch (err) {
      console.error("push", err);
    }
  }
}
