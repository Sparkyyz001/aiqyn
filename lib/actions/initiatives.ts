"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { msg } from "@/lib/i18n/server";
import { DICTS, fmt } from "@/lib/i18n/dict";
import { textChecks } from "@/lib/report-quality";
import { INITIATIVE_THRESHOLD } from "@/lib/initiatives";
import { clean, MAX_TITLE } from "@/lib/limits";

// Инициативы жителей: предложить улучшение, поддержать голосом, решение акимата.
// Порог голосов — идея автоматически уходит на рассмотрение акимата (и приходит уведомление).

const KINDS = ["yard", "lighting", "transport", "green", "sport", "accessibility", "beach", "safety", "improvement"] as const;
const STATUSES = ["voting", "review", "planned", "done", "declined"] as const;

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const RU = DICTS.ru.initiatives;
const KZ = DICTS.kz.initiatives;

async function notify(users: string[], title: [string, string], body: [string | null, string | null], id: number, tone: "info" | "ok" | "warn" = "info") {
  const uniq = [...new Set(users.filter(Boolean))];
  if (!uniq.length) return;
  await createAdminClient()
    .from("notifications")
    .insert(uniq.map((user_id) => ({ user_id, kind: "initiative", tone, title: title[0], title_kz: title[1], body: body[0], body_kz: body[1], link: `/initiatives#i-${id}` })));
}

async function akimatUsers() {
  const { data } = await createAdminClient().from("profiles").select("id").in("role", ["akimat", "operator"]);
  return (data ?? []).map((p) => p.id);
}

export async function proposeInitiative(input: { title: string; description?: string; district: string | null; kind: string }): Promise<Result<{ id: number }>> {
  const me = await getProfile();
  if (!me) return fail(await msg("login"));
  if (me.role !== "citizen") return fail(await msg("forbidden"));
  const title = clean(input.title, MAX_TITLE);
  const description = clean(input.description);
  if (title.length < 5) return fail(await msg("shortTitle"));
  const q = textChecks(title, description);
  if (q.some((c) => c.id === "text_gibberish")) return fail(await msg("textGibberish"));
  if (q.some((c) => c.id === "text_profanity")) return fail(await msg("textProfanity"));
  const kind = (KINDS as readonly string[]).includes(input.kind) ? input.kind : "improvement";
  const ref = await getReference();
  const district = input.district ? ref.districts.find((d) => d.code === input.district) : null;

  const db = createAdminClient();
  const { data, error } = await db
    .from("initiatives")
    .insert({ author_id: me.id, district_id: district?.id ?? null, kind, title, description: description || null, votes_count: 1 })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "error");
  await db.from("initiative_votes").insert({ initiative_id: data.id, user_id: me.id });
  await notify(await akimatUsers(), [fmt(RU.nNew, { title }), fmt(KZ.nNew, { title })], [null, null], data.id);
  revalidatePath("/initiatives");
  return { ok: true, data: { id: data.id } };
}

export async function voteInitiative(id: number): Promise<Result<{ votes: number; status: string }>> {
  const me = await getProfile();
  if (!me) return fail(await msg("login"));
  // голос — только у жителей: сотрудники решают, а не поддерживают
  if (me.role !== "citizen") return fail(await msg("forbidden"));
  const db = createAdminClient();
  const { data: it } = await db.from("initiatives").select("id, title, status, author_id").eq("id", id).single();
  if (!it) return fail(await msg("notFound"));
  if (it.status !== "voting" && it.status !== "review") return fail(await msg("noVoting"));
  const { error } = await db.from("initiative_votes").insert({ initiative_id: id, user_id: me.id });
  if (error) return fail(error.code === "23505" ? await msg("alreadyVoted") : error.message);
  const { count } = await db.from("initiative_votes").select("*", { count: "exact", head: true }).eq("initiative_id", id);
  const votes = count ?? 0;
  // демо-инициативы уже имеют голоса «из подложки» — прибавляем к ним, а не перезаписываем
  const { data: cur } = await db.from("initiatives").select("votes_count").eq("id", id).single();
  const next = Math.max(votes, (cur?.votes_count ?? 0) + 1);
  let status = it.status;
  if (it.status === "voting" && next >= INITIATIVE_THRESHOLD) {
    status = "review";
    const n = next;
    await notify([...(await akimatUsers()), it.author_id ?? ""], [fmt(RU.nReview, { n, title: it.title }), fmt(KZ.nReview, { n, title: it.title })], [RU.nReviewBody, KZ.nReviewBody], id, "warn");
  }
  await db.from("initiatives").update({ votes_count: next, status, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/initiatives");
  return { ok: true, data: { votes: next, status } };
}

export async function decideInitiative(id: number, input: { status: string; reply: string; budget?: number | null }): Promise<Result> {
  const me = await getProfile();
  if (!me || !["akimat", "operator"].includes(me.role)) return fail(await msg("forbidden"));
  if (!(STATUSES as readonly string[]).includes(input.status)) return fail(await msg("forbidden"));
  const reply = clean(input.reply);
  const budget = input.budget == null ? null : Number(input.budget);
  if (budget != null && !(Number.isFinite(budget) && budget >= 0)) return fail(await msg("forbidden"));
  const db = createAdminClient();
  const { data: it } = await db.from("initiatives").select("id, title, author_id").eq("id", id).single();
  if (!it) return fail(await msg("notFound"));
  await db
    .from("initiatives")
    .update({ status: input.status, akimat_reply: reply || null, budget_kzt: budget, updated_at: new Date().toISOString() })
    .eq("id", id);
  const { data: voters } = await db.from("initiative_votes").select("user_id").eq("initiative_id", id);
  await notify(
    [it.author_id ?? "", ...(voters ?? []).map((v) => v.user_id)],
    [fmt(RU.nDecision, { title: it.title }), fmt(KZ.nDecision, { title: it.title })],
    [reply || RU.status[input.status as keyof typeof RU.status], reply || KZ.status[input.status as keyof typeof KZ.status]],
    id,
    input.status === "done" || input.status === "planned" ? "ok" : input.status === "declined" ? "warn" : "info"
  );
  revalidatePath("/initiatives");
  return { ok: true, data: null };
}

// тема инициативы по категории обращения
const KIND_BY_CAT: Record<string, (typeof KINDS)[number]> = { yard: "yard", lighting: "lighting", power_outage: "lighting", transport: "transport", beach: "beach" };

/** Обращение, которое не решается, — в инициативу для бюджета (одна на обращение) */
export async function initiativeFromReport(no: string): Promise<Result<{ id: number; created: boolean }>> {
  const me = await getProfile();
  if (!me) return fail(await msg("login"));
  if (me.role !== "citizen") return fail(await msg("forbidden"));
  const db = createAdminClient();
  const { data: exists } = await db.from("initiatives").select("id").eq("report_no", no).maybeSingle();
  if (exists) return { ok: true, data: { id: exists.id, created: false } };

  const ref = await getReference();
  let src: { title: string; title_kz: string | null; category: string; district: string | null } | null = null;
  const { data: r } = await db.from("reports").select("title, title_kz, category_id, district_id").eq("public_no", no).maybeSingle();
  if (r) src = { title: r.title, title_kz: r.title_kz, category: ref.categoryById.get(r.category_id)?.code ?? "other", district: r.district_id ? ref.districtById.get(r.district_id)?.code ?? null : null };
  if (!src) return fail(await msg("notFound"));
  const district = src.district ? ref.districts.find((d) => d.code === src.district) : null;

  const { data, error } = await db
    .from("initiatives")
    .insert({
      author_id: me.id,
      district_id: district?.id ?? null,
      kind: KIND_BY_CAT[src.category] ?? "improvement",
      title: src.title.slice(0, 140),
      title_kz: src.title_kz?.slice(0, 140) ?? null,
      description: fmt(RU.reportIdea, { no, title: src.title }),
      description_kz: fmt(KZ.reportIdea, { no, title: src.title_kz ?? src.title }),
      votes_count: 1,
      report_no: no,
    })
    .select("id")
    .single();
  if (error || !data) {
    // гонка: инициативу по этому обращению только что создал кто-то другой
    const { data: again } = await db.from("initiatives").select("id").eq("report_no", no).maybeSingle();
    if (again) return { ok: true, data: { id: again.id, created: false } };
    return fail(error?.message ?? "error");
  }
  await db.from("initiative_votes").insert({ initiative_id: data.id, user_id: me.id });
  await notify(await akimatUsers(), [fmt(RU.nNew, { title: src.title }), fmt(KZ.nNew, { title: src.title_kz ?? src.title })], [null, null], data.id);
  revalidatePath("/initiatives");
  revalidatePath("/budget");
  return { ok: true, data: { id: data.id, created: true } };
}
