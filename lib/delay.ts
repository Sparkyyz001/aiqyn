// Причины задержки обращения (служба объясняет публично). Первые две — вопрос бюджета.
export const DELAY_REASONS = ["no_funding", "procurement", "materials", "contractor", "weather", "other_org", "other"] as const;
export type DelayReason = (typeof DELAY_REASONS)[number];
export const MONEY_REASONS: readonly string[] = ["no_funding", "procurement"];
