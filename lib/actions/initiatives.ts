"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { msg } from "@/lib/i18n/server";
import { DICTS, fmt } from "@/lib/i18n/dict";
import { textChecks } from "@/lib/report-quality";
import { INITIATIVE_THRESHOLD } from "@/lib/initiatives";

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
  const title = input.title?.trim();
  if (!title || title.length < 5) return fail(await msg("shortTitle"));
  const q = textChecks(title, input.description ?? "");
  if (q.some((c) => c.id === "text_gibberish")) return fail(await msg("textGibberish"));
  if (q.some((c) => c.id === "text_profanity")) return fail(await msg("textProfanity"));
  const kind = (KINDS as readonly string[]).includes(input.kind) ? input.kind : "improvement";
  const ref = await getReference();
  const district = input.district ? ref.districts.find((d) => d.code === input.district) : null;

  const db = createAdminClient();
  const { data, error } = await db
    .from("initiatives")
    .insert({ author_id: me.id, district_id: district?.id ?? null, kind, title, description: input.description?.trim() || null, votes_count: 1 })
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
  const db = createAdminClient();
  const { data: it } = await db.from("initiatives").select("id, title, status, author_id").eq("id", id).single();
  if (!it) return fail(await msg("notFound"));
  if (it.status !== "voting" && it.status !== "review") return fail(await msg("noVoting"));
  const { error } = await db.from("initiative_votes").insert({ initiative_id: id, user_id: me.id });
  if (error) return fail(error.code === "23505" ? await msg("alreadyVoted") : error.message);
  const { count } = await db.from("initiative_votes").select("*", { count: "exact", head: true }).eq("initiative_id", id);
  const votes = (count ?? 0) + 0;
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
  const db = createAdminClient();
  const { data: it } = await db.from("initiatives").select("id, title, author_id").eq("id", id).single();
  if (!it) return fail(await msg("notFound"));
  await db
    .from("initiatives")
    .update({ status: input.status, akimat_reply: input.reply.trim() || null, budget_kzt: input.budget ?? null, updated_at: new Date().toISOString() })
    .eq("id", id);
  const { data: voters } = await db.from("initiative_votes").select("user_id").eq("initiative_id", id);
  await notify(
    [it.author_id ?? "", ...(voters ?? []).map((v) => v.user_id)],
    [fmt(RU.nDecision, { title: it.title }), fmt(KZ.nDecision, { title: it.title })],
    [input.reply.trim() || RU.status[input.status as keyof typeof RU.status], input.reply.trim() || KZ.status[input.status as keyof typeof KZ.status]],
    id,
    input.status === "done" || input.status === "planned" ? "ok" : input.status === "declined" ? "warn" : "info"
  );
  revalidatePath("/initiatives");
  return { ok: true, data: null };
}
