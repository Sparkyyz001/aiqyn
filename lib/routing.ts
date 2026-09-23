// Маршрутизация обращения к ответственной службе (ТЗ, 6.1).
// По умолчанию — categories.default_service. Исключения — явная таблица правил ниже,
// проверяются сверху вниз, первое сработавшее побеждает. Каждое правило объяснимо.

import { normalize, type CategoryCode } from "./classify";

type RoutingRule = {
  id: string;
  when: (category: CategoryCode, text: string) => boolean;
  service: string; // код службы из data/services.json
  reason: string; // показывается в карточке и хронологии
};

const has = (text: string, stems: string[]) => stems.some((s) => text.includes(s));

export const ROUTING_RULES: RoutingRule[] = [
  {
    id: "pit-after-excavation",
    when: (c, t) => c === "road_pit" && has(t, ["раскоп", "разрыт", "перекоп", "траншея", "траншею", "после ремонт", "кжса", "қазылған"]),
    service: "kzhsa",
    reason: "Яма после раскопок: восстановление покрытия — обязанность того, кто копал (КЖСА), а не дорожников",
  },
  {
    id: "no-water-maek",
    when: (c, t) => c === "water_outage" && has(t, ["опреснен", "маэк"]),
    service: "maek",
    reason: "Упоминается опреснение/МАЭК: производство воды для города",
  },
  {
    id: "garbage-in-yard-dump",
    when: (c, t) => c === "yard" && has(t, ["мусор", "свалк", "қоқыс"]),
    service: "sanitary",
    reason: "Мусор во дворе — вывоз ТБО, единый оператор Zero Waste Ақтау",
  },
  {
    id: "smell-sewage",
    when: (c, t) => c === "smell" && has(t, ["канализ", "люк", "кәріз"]),
    service: "kzhsa",
    reason: "Запах из канализации — сети КЖСА, а не промышленный выброс",
  },
];

export type RoutingResult = { service: string; rule: string | null; reason: string };

export function route(category: CategoryCode, text: string, defaultService: string): RoutingResult {
  const norm = normalize(text);
  for (const r of ROUTING_RULES) {
    if (r.when(category, norm)) return { service: r.service, rule: r.id, reason: r.reason };
  }
  return { service: defaultService, rule: null, reason: "Служба по умолчанию для категории" };
}
