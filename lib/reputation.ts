import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Репутация жителя (ADDON_3): доверие к голосу, а не игровые очки.
// Начисляется за полезное участие, каждое изменение — в журнале reputation_events, житель видит
// свою историю понятными словами. Чужую репутацию не показываем нигде. Право подать обращение
// от репутации не зависит; срок по закону и очередь службы — тоже.

export const REP_START = 1;
export const REP_MIN = 0.1;
export const REP_MAX = 10;
const DAY = 86_400_000;

export type RepReason = "confirmed" | "resolved" | "helped" | "rejected";
export const REP_DELTA: Record<RepReason, number> = { confirmed: 0.5, resolved: 3, helped: 1, rejected: -2 };
/** «Сосед подтвердил» — не больше +5 за одно обращение */
const CONFIRMED_CAP = 5;

export const LEVELS = [
  { key: "resident", min: 0 },
  { key: "active", min: 2 },
  { key: "watcher", min: 5 },
] as const;

export function levelOf(rep: number) {
  const i = LEVELS.findLastIndex((l) => rep >= l.min);
  const next = LEVELS[i + 1] ?? null;
  const from = LEVELS[i].min;
  return { key: LEVELS[i].key, index: i, next: next?.key ?? null, progress: next ? Math.min(1, (rep - from) / (next.min - from)) : 1, toNext: next ? Math.max(0, next.min - rep) : 0 };
}

/**
 * Вес голоса = √репутации, от 0,1 до 3: активист влиятельнее новичка, но в одиночку не перевешивает
 * группу жителей (репутация 9 даёт вес 3, а не 9). Аккаунт младше суток — 0,3 независимо от репутации.
 */
export function voteWeight(rep: number, accountCreatedAt?: string | null, now = Date.now()) {
  if (accountCreatedAt && now - new Date(accountCreatedAt).getTime() < DAY) return 0.3;
  return Math.round(Math.min(3, Math.max(0.1, Math.sqrt(Math.max(rep, 0)))) * 100) / 100;
}

/** Начислить или списать репутацию с записью в журнал. Сбой не ломает основное действие. */
export async function addReputation(userId: string | null | undefined, reason: RepReason, reportId?: number | null, meta?: Record<string, unknown>) {
  if (!userId) return;
  try {
    const db = createAdminClient();
    let delta = REP_DELTA[reason];
    if (reason === "confirmed" && reportId) {
      const { data: prev } = await db.from("reputation_events").select("delta").eq("user_id", userId).eq("report_id", reportId).eq("reason", "confirmed");
      const got = (prev ?? []).reduce((s, e) => s + Number(e.delta), 0);
      delta = Math.min(delta, CONFIRMED_CAP - got);
      if (delta <= 0) return;
    }
    const { data: p } = await db.from("profiles").select("reputation").eq("id", userId).single();
    const cur = Number(p?.reputation ?? REP_START);
    const next = Math.round(Math.min(REP_MAX, Math.max(REP_MIN, cur + delta)) * 100) / 100;
    await db.from("profiles").update({ reputation: next }).eq("id", userId);
    await db.from("reputation_events").insert({ user_id: userId, report_id: reportId ?? null, delta: Math.round((next - cur) * 100) / 100, reason, meta: meta ?? null });
  } catch (e) {
    console.error("reputation", (e as Error).message);
  }
}
