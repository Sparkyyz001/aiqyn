// ФИШКА 1: заявку закрывает житель, а не служба.
//
// Кто голосует: автор обращения и все, кто его подтверждал («я тоже это вижу»).
// Вес голоса = репутация (profiles.reputation). Автор — главный свидетель, его вес ×2.
// Решение:
//   Σ весов «сделано»    > половины общего веса голосующих → resolved
//   Σ весов «не сделано» > половины                         → reopened (reopen_count++)
//   окно 72 часа истекло → по большинству поданных голосов; без возражений → resolved
// Пока ни одно условие не выполнено — ждём (awaiting_confirmation).

export const VOTING_WINDOW_H = 72;
export const AUTHOR_WEIGHT_MULT = 2;

export type Voter = { user_id: string; weight: number; isAuthor: boolean };
export type Vote = { user_id: string; verdict: "fixed" | "not_fixed"; weight: number };
export type Outcome = "resolved" | "reopened" | "pending";

const w = (v: { weight: number }, isAuthor: boolean) => v.weight * (isAuthor ? AUTHOR_WEIGHT_MULT : 1);

export function decide(voters: Voter[], votes: Vote[], windowExpired: boolean): { outcome: Outcome; fixed: number; notFixed: number; total: number } {
  const authorIds = new Set(voters.filter((v) => v.isAuthor).map((v) => v.user_id));
  const total = voters.reduce((s, v) => s + w(v, v.isAuthor), 0);
  let fixed = 0;
  let notFixed = 0;
  for (const v of votes) {
    const weight = w(v, authorIds.has(v.user_id));
    if (v.verdict === "fixed") fixed += weight;
    else notFixed += weight;
  }
  const r = (x: number) => Math.round(x * 100) / 100;
  const res = { fixed: r(fixed), notFixed: r(notFixed), total: r(total) };
  if (total > 0 && fixed > total / 2) return { outcome: "resolved", ...res };
  if (total > 0 && notFixed > total / 2) return { outcome: "reopened", ...res };
  if (windowExpired) return { outcome: notFixed > fixed ? "reopened" : "resolved", ...res };
  return { outcome: "pending", ...res };
}
