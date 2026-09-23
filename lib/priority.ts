// Формула приоритета (ТЗ, 6.4). Отвечает на вопрос жюри «почему эта заявка выше той?»:
// computePriority возвращает не только число, но и вклад каждого слагаемого.
//
// priority_score =
//     severity_base                               базовая важность категории (вода 75, яма 55, пляж 30)
//   + 12 * ln(1 + Σ весов подтверждений)          сколько людей видят проблему; логарифм — чтобы
//                                                 100 подтверждений не перевешивали всё остальное
//   + 10 * min(1, дней в очереди / sla_days)      чем дольше висит, тем выше — до истечения срока;
//                                                 после срока время учитывает слагаемое «SLA нарушен»,
//                                                 иначе старая просрочка считалась бы дважды (решение команды)
//   + 15 * [рядом школа/садик/больница ≤150 м]    риск для детей и пациентов
//   + 20 * [SLA нарушен]                          закон уже нарушен
//   + 10 * chronic_score кластера (0..1)          хроническая точка: жалуются снова и снова
//   + 15 * reopen_count                           служба уже «закрывала», а жители опровергли

export const W = {
  confirmations: 12,
  queue: 10,
  social: 15,
  slaBreached: 20,
  chronic: 10,
  reopen: 15,
} as const;

export const SOCIAL_RADIUS_M = 150;

export type PriorityInput = {
  severityBase: number;
  confirmationWeights: number; // Σ весов (вес = репутация подтвердившего)
  daysInQueue: number;
  slaDays: number;
  nearSocial: boolean;
  slaBreached: boolean;
  chronicScore: number; // 0..1
  reopenCount: number;
};

export type PriorityTerm = { key: keyof typeof W | "severity"; value: number };

export function computePriority(i: PriorityInput): { score: number; terms: PriorityTerm[] } {
  const terms: PriorityTerm[] = [
    { key: "severity", value: i.severityBase },
    { key: "confirmations", value: W.confirmations * Math.log(1 + Math.max(0, i.confirmationWeights)) },
    { key: "queue", value: W.queue * Math.min(1, Math.max(0, i.daysInQueue) / Math.max(1, i.slaDays)) },
    { key: "social", value: i.nearSocial ? W.social : 0 },
    { key: "slaBreached", value: i.slaBreached ? W.slaBreached : 0 },
    { key: "chronic", value: W.chronic * Math.min(1, Math.max(0, i.chronicScore)) },
    { key: "reopen", value: W.reopen * i.reopenCount },
  ].map((t) => ({ ...t, value: Math.round(t.value * 10) / 10 })) as PriorityTerm[];
  const score = Math.round(terms.reduce((s, t) => s + t.value, 0) * 10) / 10;
  return { score, terms };
}

export const PRIORITY_LABELS: Record<PriorityTerm["key"], { ru: string; kz: string }> = {
  severity: { ru: "Важность категории", kz: "Санат маңыздылығы" },
  confirmations: { ru: "Подтверждения жителей", kz: "Тұрғындар растауы" },
  queue: { ru: "Время в очереди", kz: "Кезектегі уақыт" },
  social: { ru: "Рядом школа / садик / больница", kz: "Жақында мектеп / балабақша / аурухана" },
  slaBreached: { ru: "Срок нарушен", kz: "Мерзім бұзылды" },
  chronic: { ru: "Хроническая точка", kz: "Созылмалы нүкте" },
  reopen: { ru: "Переоткрытия", kz: "Қайта ашулар" },
};
