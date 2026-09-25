"use server";

import { getDict, msg } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { getProfile, type Profile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference, districtAt, nearestSocial } from "@/lib/reference";
import { classify, type CategoryCode } from "@/lib/classify";
import { route } from "@/lib/routing";
import { findDuplicates, DEDUPE_RADIUS_M, DEDUPE_WINDOW_DAYS } from "@/lib/dedupe";
import { bboxAround, haversine, inAktau } from "@/lib/geo";
import { slaDueAt, slaDueAfterReopen } from "@/lib/sla";
import { decide, VOTING_WINDOW_H } from "@/lib/verification";
import { boilerplateScore } from "@/lib/boilerplate";
import { recomputeReport, logEvent } from "@/lib/report-engine";
import { recomputeClustersAround } from "@/lib/clustering-db";
import { incidentTypeFor } from "@/lib/incidents";
import { textChecks, photoChecks, worst, type PhotoStats } from "@/lib/report-quality";
import { analyzePhotoUrl, aiEnabled, type Vision } from "@/lib/ai-vision";
import { compareBeforeAfter, blocks, type AiCheck } from "@/lib/ai-compare";

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });

export type PhotoInput = { path: string; lat: number | null; lng: number | null; taken_at: string | null; stats?: PhotoStats | null };

const PHOTO_GEO_RADIUS_M = 100; // ФИШКА 6: фото «после» не дальше 100 м от точки обращения

function publicPhotoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/report-photos/${path}`;
}

// Фото загружает браузер в Storage в папку со своим uid — проверяем, что путь его
const ownsPath = (p: Profile, path: string) => path.startsWith(p.id + "/") && !path.includes("..");

// ---------------------------------------------------------------------------
// ПОДАЧА: предпросмотр (категория, служба, район, дубликаты) и создание
// ---------------------------------------------------------------------------

export type Preview = {
  category: CategoryCode;
  confidence: number;
  needsManual: boolean;
  matched: string[];
  service: { code: string; name_ru: string; name_kz: string };
  routingReason: string;
  routingRule: string | null;
  district: { id: number; name_ru: string; name_kz: string } | null;
  nearSocial: { name: string | null; amenity: string; distance_m: number } | null;
  duplicates: {
    id: number; public_no: string; title: string; status: string; distance_m: number;
    confirmations_count: number; sla_due_at: string | null; created_at: string; photo: string | null;
  }[];
};

export async function previewReport(input: { text: string; lat: number; lng: number; category?: CategoryCode | null }): Promise<Result<Preview>> {
  if (!inAktau(input)) return fail(await msg("outside"));
  const ref = await getReference();
  const cls = classify(input.text);
  const code = input.category ?? cls.category;
  const cat = ref.categoryByCode.get(code) ?? ref.categoryByCode.get("other")!;
  const defaultSvc = ref.serviceById.get(cat.default_service!)!;
  const routing = route(cat.code as CategoryCode, input.text, defaultSvc.code);
  const svc = ref.serviceByCode.get(routing.service) ?? defaultSvc;
  const district = districtAt(input, ref.districts);

  const db = createAdminClient();
  const bb = bboxAround(input, DEDUPE_RADIUS_M);
  const { data: near } = await db
    .from("reports")
    .select("id, public_no, title, status, lat, lng, category_id, confirmations_count, sla_due_at, created_at, report_photos(url, kind)")
    .eq("category_id", cat.id)
    .eq("is_synthetic", false)
    .gte("lat", bb.minLat).lte("lat", bb.maxLat)
    .gte("lng", bb.minLng).lte("lng", bb.maxLng)
    .gte("created_at", new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86400_000).toISOString());
  const dups = findDuplicates({ ...input, category_id: cat.id }, near ?? []).slice(0, 3);

  const social = nearestSocial(input);
  return {
    ok: true,
    data: {
      category: cat.code as CategoryCode,
      confidence: input.category ? 1 : cls.confidence,
      needsManual: input.category ? false : cls.needsManual,
      matched: cls.matched,
      service: { code: svc.code, name_ru: svc.name_ru, name_kz: svc.name_kz },
      routingReason: routing.reason,
      routingRule: routing.rule,
      district: district ? { id: district.id, name_ru: district.name_ru, name_kz: district.name_kz } : null,
      nearSocial: social ? { name: social.name, amenity: social.amenity, distance_m: social.distance_m } : null,
      duplicates: dups.map((d) => ({
        id: d.id, public_no: d.public_no, title: d.title, status: d.status, distance_m: d.distance_m,
        confirmations_count: d.confirmations_count, sla_due_at: d.sla_due_at, created_at: d.created_at,
        photo: d.report_photos?.find((p: { kind: string }) => p.kind === "before")?.url ?? null,
      })),
    },
  };
}

export type CreateInput = {
  title: string;
  description?: string;
  lat: number;
  lng: number;
  address_text?: string;
  category: CategoryCode;
  photos: PhotoInput[];
  source?: "app" | "operator" | "call109" | "instagram";
  source_url?: string;
  /** ответ ИИ-зрения по первому фото (если ИИ включён) — логируем в хронологию */
  ai?: Vision | null;
};

export async function createReport(input: CreateInput): Promise<Result<{ public_no: string }>> {
  const me = await getProfile();
  if (!me) return fail(await msg("login"));
  const title = input.title?.trim();
  if (!title || title.length < 3) return fail(await msg("shortTitle"));
  if (!inAktau(input)) return fail(await msg("outside"));

  // Проверка качества — те же правила, что видит житель в форме (обойти из консоли нельзя)
  const tq = textChecks(title, input.description ?? "");
  if (tq.some((c) => c.id === "text_gibberish")) return fail(await msg("textGibberish"));
  if (tq.some((c) => c.id === "text_profanity")) return fail(await msg("textProfanity"));
  if (input.photos.some((p) => worst(photoChecks({ stats: p.stats ?? null })) === "fail")) return fail(await msg("photoBad"));
  if (input.ai && !input.ai.is_city_problem) return fail(await msg("notProblem"));
  if (me.role === "citizen") {
    const dbq = createAdminClient();
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { data: mine } = await dbq.from("reports").select("public_no, lat, lng, created_at").eq("author_id", me.id).gte("created_at", new Date(Date.now() - 12 * 3600_000).toISOString());
    if ((mine ?? []).filter((r) => r.created_at >= hourAgo).length >= 5) return fail(await msg("rateLimit"));
    const same = (mine ?? []).find((r) => haversine(input, r) < 60);
    if (same) return fail(await msg("repeatHere", { no: same.public_no }));
  }

  // Источник «оператор/109/Instagram» — только для оператора и акимата
  const source = input.source ?? "app";
  if (source !== "app" && !["operator", "akimat"].includes(me.role)) return fail(await msg("forbidden"));
  if (source === "instagram" && !/^https:\/\/(www\.)?instagram\.com\//.test(input.source_url ?? ""))
    return fail(await msg("instagramUrl"));

  const ref = await getReference();
  const cat = ref.categoryByCode.get(input.category) ?? ref.categoryByCode.get("other")!;
  const text = `${title} ${input.description ?? ""}`;
  const routing = route(cat.code as CategoryCode, text, ref.serviceById.get(cat.default_service!)!.code);
  const svc = ref.serviceByCode.get(routing.service)!;
  const district = districtAt(input, ref.districts);
  const now = new Date();

  const db = createAdminClient();

  // ФИШКА 5: точка внутри активной аварии того же типа → привязываем к аварии
  const incident = await matchIncident(cat.code, input);

  const { data: report, error } = await db
    .from("reports")
    .insert({
      author_id: me.id,
      category_id: cat.id,
      service_id: svc.id,
      district_id: district?.id ?? null,
      incident_id: incident?.id ?? null,
      title,
      description: input.description?.trim() || null,
      lat: input.lat,
      lng: input.lng,
      address_text: input.address_text?.trim() || null,
      status: "routed",
      severity: cat.severity_base,
      sla_due_at: slaDueAt(now, cat.sla_days).toISOString(),
      source,
      source_url: input.source_url?.trim() || null,
    })
    .select("id, public_no")
    .single();
  if (error || !report) return fail(error?.message ?? await msg("createFailed"));

  const photos = input.photos.filter((p) => ownsPath(me, p.path)).slice(0, 5);
  if (photos.length) {
    await db.from("report_photos").insert(
      photos.map((p) => ({
        report_id: report.id,
        url: publicPhotoUrl(p.path),
        kind: "before",
        lat: p.lat,
        lng: p.lng,
        taken_at: p.taken_at,
        geo_verified: p.lat != null && p.lng != null && haversine(input, { lat: p.lat, lng: p.lng }) <= PHOTO_GEO_RADIUS_M,
        uploaded_by: me.id,
      }))
    );
  }

  if (input.ai) {
    await logEvent({ report_id: report.id, actor_id: null, type: "ai_analysis", meta: { ...input.ai } });
  }
  await logEvent({ report_id: report.id, actor_id: me.id, type: "created", to_status: "new", meta: { source, source_url: input.source_url ?? null, quality: [...tq.map((c) => c.id)] } });
  await logEvent({
    report_id: report.id, actor_id: null, type: "routed", from_status: "new", to_status: "routed",
    comment: `${svc.short_name}: ${routing.reason}`, meta: { service: svc.code, rule: routing.rule },
  });
  if (incident) {
    await logEvent({
      report_id: report.id, actor_id: null, type: "incident_linked",
      comment: `Известная авария: ${incident.title}`, meta: { msg: "incident", title: incident.title, incident_id: incident.id, eta_at: incident.eta_at },
    });
  }

  await recomputeClustersAround(report.id);
  await recomputeReport(report.id);
  revalidatePath("/");
  revalidatePath("/map");
  return { ok: true, data: { public_no: report.public_no } };
}

async function matchIncident(categoryCode: string, p: { lat: number; lng: number }) {
  const type = incidentTypeFor(categoryCode);
  if (!type) return null;
  const { pointInPolygon } = await import("@/lib/geo");
  const db = createAdminClient();
  const { data } = await db.from("incidents").select("id, title, eta_at, polygon, type").eq("status", "active").eq("type", type);
  return (data ?? []).find((i) => pointInPolygon(p, i.polygon)) ?? null;
}

// ---------------------------------------------------------------------------
// «Я тоже это вижу»
// ---------------------------------------------------------------------------

export async function confirmReport(reportId: number): Promise<Result<{ count: number }>> {
  const me = await getProfile();
  if (!me) return fail(await msg("login"));
  const db = createAdminClient();
  const { data: r } = await db.from("reports").select("id, author_id, status, public_no").eq("id", reportId).single();
  if (!r) return fail(await msg("notFound"));
  if (r.author_id === me.id) return fail(await msg("ownReport"));
  if (["resolved", "rejected"].includes(r.status)) return fail(await msg("closed"));

  const { error } = await db.from("report_confirmations").insert({ report_id: r.id, user_id: me.id });
  if (error) return fail(error.code === "23505" ? await msg("alreadyConfirmed") : error.message);
  await logEvent({ report_id: r.id, actor_id: me.id, type: "confirmed" });
  await recomputeReport(r.id);

  const { data: after } = await db.from("reports").select("confirmations_count").eq("id", r.id).single();
  revalidatePath(`/report/${r.public_no}`);
  return { ok: true, data: { count: after?.confirmations_count ?? 0 } };
}

// ---------------------------------------------------------------------------
// Служба: принять / в работу / отклонить / закрыть с фото «после»
// ---------------------------------------------------------------------------

async function loadForStaff(reportId: number) {
  const me = await getProfile();
  if (!me) return { error: await msg("login") } as const;
  const db = createAdminClient();
  const { data: r } = await db.from("reports").select("*").eq("id", reportId).single();
  if (!r) return { error: await msg("notFound") } as const;
  const allowed = ["akimat", "operator"].includes(me.role) || (me.role === "service" && me.service_id === r.service_id);
  if (!allowed) return { error: await msg("notInQueue") } as const;
  return { me, r, db } as const;
}

// Разрешённые переходы жизненного цикла (ТЗ, 6.6)
const TRANSITIONS = {
  accept: { from: ["new", "routed", "reopened"], to: "accepted" },
  start: { from: ["accepted", "reopened"], to: "in_progress" },
  reject: { from: ["new", "routed", "accepted"], to: "rejected" },
} as const;

export async function staffTransition(reportId: number, action: keyof typeof TRANSITIONS, comment?: string): Promise<Result> {
  const ctx = await loadForStaff(reportId);
  if ("error" in ctx) return fail(ctx.error!);
  const { me, r, db } = ctx;
  const t = TRANSITIONS[action];
  if (!(t.from as readonly string[]).includes(r.status)) return fail(await msg("badTransition", { s: r.status }));
  if (action === "reject" && !comment?.trim()) return fail(await msg("rejectReason"));

  const patch: Record<string, unknown> = { status: t.to };
  if (action === "accept" && !r.accepted_at) patch.accepted_at = new Date().toISOString();
  if (action === "reject") patch.closed_at = new Date().toISOString();
  await db.from("reports").update(patch).eq("id", r.id);
  await logEvent({ report_id: r.id, actor_id: me.id, type: "status_change", from_status: r.status, to_status: t.to, comment: comment?.trim() || null });
  if (comment?.trim() && action !== "reject") await addReplyInternal(r.id, r.service_id, me.id, comment.trim());
  await recomputeReport(r.id);
  revalidatePath(`/report/${r.public_no}`);
  revalidatePath("/service");
  return { ok: true, data: null };
}

/**
 * ФИШКА 6: закрыть без фото «после» невозможно.
 * Сверяем EXIF: ≤100 м от точки обращения и снято позже, чем заявку приняли.
 * Если не сошлось — не блокируем, но geo_verified=false (бейдж + метрика качества службы).
 */
export async function submitCompletion(reportId: number, photo: PhotoInput, comment?: string): Promise<Result<{ geo_verified: boolean; reasons: { code: string; d?: number; max?: number }[]; ai: AiCheck | null }>> {
  const ctx = await loadForStaff(reportId);
  if ("error" in ctx) return fail(ctx.error!);
  const { me, r, db } = ctx;
  if (!["accepted", "in_progress", "reopened"].includes(r.status)) return fail(await msg("acceptFirst"));
  if (!photo?.path || !ownsPath(me, photo.path)) return fail(await msg("afterPhoto"));

  const reasons: string[] = [];
  const reasonCodes: { code: string; d?: number; max?: number }[] = [];
  let geoOk = false;
  if (photo.lat == null || photo.lng == null) {
    reasons.push("в фото нет GPS-координат");
    reasonCodes.push({ code: "no_gps" });
  }
  else {
    const d = Math.round(haversine(r, { lat: photo.lat, lng: photo.lng }));
    geoOk = d <= PHOTO_GEO_RADIUS_M;
    if (!geoOk) {
      reasons.push(`снято в ${d} м от точки обращения (допустимо ${PHOTO_GEO_RADIUS_M} м)`);
      reasonCodes.push({ code: "far", d, max: PHOTO_GEO_RADIUS_M });
    }
  }
  const acceptedAt = r.accepted_at ? new Date(r.accepted_at) : new Date(r.created_at);
  let fresh = false;
  if (!photo.taken_at) {
    reasons.push("в фото нет даты съёмки");
    reasonCodes.push({ code: "no_date" });
  }
  else {
    fresh = new Date(photo.taken_at) > acceptedAt;
    if (!fresh) {
      reasons.push("фото снято раньше, чем заявку приняли в работу");
      reasonCodes.push({ code: "too_early" });
    }
  }
  const verified = geoOk && fresh;

  // ИИ-сверка с фото жителя: очевидную отписку (другое место / проблема на месте) не закрыть
  const { data: beforePhotos } = await db.from("report_photos").select("url").eq("report_id", r.id).eq("kind", "before").order("created_at");
  const ref = await getReference();
  const ai = await compareBeforeAfter({
    before: (beforePhotos ?? []).map((p) => p.url),
    after: publicPhotoUrl(photo.path),
    title: r.title,
    category: ref.categoryById.get(r.category_id)?.code ?? "other",
  });
  if (blocks(ai)) {
    const { lang } = await getDict();
    await logEvent({
      report_id: r.id, actor_id: me.id, type: "ai_after_check", comment: ai!.explanation_ru,
      meta: { msg: "ai_blocked", verdict: ai!.verdict, confidence: ai!.confidence, why_ru: ai!.explanation_ru, why_kz: ai!.explanation_kz },
    });
    return fail(await msg(ai!.verdict === "different_place" ? "aiDifferentPlace" : "aiNotFixed", { why: lang === "kz" ? ai!.explanation_kz : ai!.explanation_ru }));
  }

  await db.from("report_photos").insert({
    report_id: r.id, url: publicPhotoUrl(photo.path), kind: "after",
    lat: photo.lat, lng: photo.lng, taken_at: photo.taken_at, geo_verified: verified, uploaded_by: me.id, ai_check: ai,
  });
  const dueVote = new Date(Date.now() + VOTING_WINDOW_H * 3600_000).toISOString();
  await db.from("reports").update({ status: "awaiting_confirmation", verification_due_at: dueVote }).eq("id", r.id);
  await logEvent({
    report_id: r.id, actor_id: me.id, type: "status_change", from_status: r.status, to_status: "awaiting_confirmation",
    comment: comment?.trim() || "Служба сообщает, что проблема решена",
    meta: { msg: comment?.trim() ? undefined : "service_done", photo_geo_verified: verified, reasons, reason_codes: reasonCodes, voting_until: dueVote, ai_verdict: ai?.verdict ?? null, ai_confidence: ai?.confidence ?? null },
  });
  if (comment?.trim()) await addReplyInternal(r.id, r.service_id, me.id, comment.trim());
  await recomputeReport(r.id);
  revalidatePath(`/report/${r.public_no}`);
  revalidatePath("/service");
  return { ok: true, data: { geo_verified: verified, reasons: reasonCodes, ai } };
}

async function addReplyInternal(reportId: number, serviceId: number, authorId: string, text: string) {
  const db = createAdminClient();
  await db.from("service_replies").insert({
    report_id: reportId, service_id: serviceId, author_id: authorId, text, boilerplate_score: boilerplateScore(text).score,
  });
  await logEvent({ report_id: reportId, actor_id: authorId, type: "reply", comment: text });
}

export async function addReply(reportId: number, text: string): Promise<Result> {
  const ctx = await loadForStaff(reportId);
  if ("error" in ctx) return fail(ctx.error!);
  if (!text?.trim()) return fail(await msg("emptyReply"));
  await addReplyInternal(ctx.r.id, ctx.r.service_id, ctx.me.id, text.trim());
  revalidatePath(`/report/${ctx.r.public_no}`);
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// ФИШКА 1: житель подтверждает или опровергает выполнение
// ---------------------------------------------------------------------------

export async function castVerification(reportId: number, verdict: "fixed" | "not_fixed", comment?: string): Promise<Result<{ outcome: string }>> {
  const me = await getProfile();
  if (!me) return fail(await msg("login"));
  const db = createAdminClient();
  const { data: r } = await db.from("reports").select("id, author_id, status, reopen_count, public_no").eq("id", reportId).single();
  if (!r) return fail(await msg("notFound"));
  if (r.status !== "awaiting_confirmation") return fail(await msg("noVoting"));

  const { data: conf } = await db.from("report_confirmations").select("user_id").eq("report_id", r.id);
  const involved = r.author_id === me.id || (conf ?? []).some((c) => c.user_id === me.id);
  if (!involved) return fail(await msg("notVoter"));

  const { error } = await db.from("report_verifications").insert({
    report_id: r.id, user_id: me.id, verdict, comment: comment?.trim() || null, round: r.reopen_count,
  });
  if (error) return fail(error.code === "23505" ? await msg("alreadyVoted") : error.message);
  await logEvent({ report_id: r.id, actor_id: me.id, type: "verification", comment: comment?.trim() || null, meta: { verdict } });

  const outcome = await settleVerification(r.id);
  revalidatePath(`/report/${r.public_no}`);
  return { ok: true, data: { outcome } };
}

/** Подводит итог голосования (после каждого голоса и лениво при открытии карточки) */
export async function settleVerification(reportId: number): Promise<string> {
  const db = createAdminClient();
  const { data: r } = await db
    .from("reports")
    .select("id, author_id, status, reopen_count, verification_due_at, sla_due_at, service_id, public_no")
    .eq("id", reportId)
    .single();
  if (!r || r.status !== "awaiting_confirmation") return "noop";

  const [{ data: conf }, { data: votes }, { data: profs }] = await Promise.all([
    db.from("report_confirmations").select("user_id, weight").eq("report_id", r.id),
    db.from("report_verifications").select("user_id, verdict, weight").eq("report_id", r.id).eq("round", r.reopen_count),
    r.author_id ? db.from("profiles").select("id, reputation").eq("id", r.author_id) : Promise.resolve({ data: [] }),
  ]);
  const voters = [
    ...(r.author_id ? [{ user_id: r.author_id, weight: Number(profs?.[0]?.reputation ?? 1), isAuthor: true }] : []),
    ...(conf ?? []).map((c) => ({ user_id: c.user_id, weight: Number(c.weight), isAuthor: false })),
  ];
  const expired = !!r.verification_due_at && new Date(r.verification_due_at) < new Date();
  const d = decide(voters, (votes ?? []).map((v) => ({ ...v, weight: Number(v.weight) })), expired);
  if (d.outcome === "pending") return "pending";

  const now = new Date();
  if (d.outcome === "resolved") {
    await db.from("reports").update({ status: "resolved", resolved_at: now.toISOString(), closed_at: now.toISOString() }).eq("id", r.id);
    await logEvent({
      report_id: r.id, actor_id: null, type: "status_change", from_status: "awaiting_confirmation", to_status: "resolved",
      comment: expired && d.fixed === 0 ? "Окно 72 ч истекло без возражений" : "Жители подтвердили выполнение",
      meta: { ...d, msg: expired && d.fixed === 0 ? "vote_expired" : "vote_fixed" },
    });
  } else {
    const newDue = slaDueAfterReopen(new Date(r.sla_due_at ?? now), now);
    await db
      .from("reports")
      .update({ status: "reopened", reopen_count: r.reopen_count + 1, sla_due_at: newDue.toISOString(), verification_due_at: null })
      .eq("id", r.id);
    await logEvent({
      report_id: r.id, actor_id: null, type: "reopened", from_status: "awaiting_confirmation", to_status: "reopened",
      comment: "Жители сообщили: не сделано. Обращение переоткрыто", meta: { ...d, msg: "vote_not_fixed", new_sla_due_at: newDue.toISOString() },
    });
  }
  await recomputeClustersAround(r.id);
  await recomputeReport(r.id);
  revalidatePath("/service");
  return d.outcome;
}

// ---------------------------------------------------------------------------
// ИИ-зрение по загруженному фото (PROMPTS_AI_VISION.md, промпт 1). Без ключа — { enabled: false }
// ---------------------------------------------------------------------------

export async function analyzePhoto(input: { path: string; text?: string; lat?: number | null; lng?: number | null; taken_at?: string | null }): Promise<Result<{ enabled: boolean; vision: Vision | null }>> {
  const me = await getProfile();
  if (!me) return fail(await msg("login"));
  if (!aiEnabled()) return { ok: true, data: { enabled: false, vision: null } };
  if (!ownsPath(me, input.path)) return fail(await msg("forbidden"));
  const ref = await getReference();
  const district = input.lat != null && input.lng != null ? districtAt({ lat: input.lat, lng: input.lng }, ref.districts) : null;
  const vision = await analyzePhotoUrl(publicPhotoUrl(input.path), { text: input.text, district: district?.name_ru ?? null, takenAt: input.taken_at ?? null });
  return { ok: true, data: { enabled: true, vision } };
}
