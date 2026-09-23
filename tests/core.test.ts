// Тесты ядра механик. Запуск: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { addWorkingDays, holidaysOf, slaDueAfterReopen, slaState, workingDaysBetween } from "../lib/sla";
import { classify } from "../lib/classify";
import { route } from "../lib/routing";
import { findDuplicates } from "../lib/dedupe";
import { computePriority } from "../lib/priority";
import { haversine, pointInPolygon } from "../lib/geo";

const aktau = (s: string) => new Date(s + "+05:00");

test("SLA: 15 рабочих дней, день поступления не считается, срок до 18:00", () => {
  // Подано пн 07.09.2026 → считаем с 08.09: 8–11 (4), 14–18 (9), 21–25 (14), 28 (15) → пн 28.09 18:00
  const due = addWorkingDays(aktau("2026-09-07T10:00:00"), 15);
  assert.equal(due.toISOString(), aktau("2026-09-28T18:00:00").toISOString());
});

test("SLA: праздники РК и перенос выходного", () => {
  const h = holidaysOf(2026);
  assert.ok(h.has("2026-03-23"), "Наурыз");
  assert.ok(h.has("2026-10-25"), "День Республики");
  assert.ok(h.has("2026-12-16"), "День Независимости");
  assert.ok(h.has("2026-05-27"), "Курбан айт");
  // 25.10.2026 — воскресенье → выходной переносится на пн 26.10
  assert.ok(h.has("2026-10-26"), "перенос Дня Республики");
  // 7 января (Рождество) не переносится: 07.01.2024 — воскресенье, 08.01.2024 — рабочий
  assert.ok(!holidaysOf(2024).has("2024-01-08"));
});

test("SLA: Наурыз удлиняет срок", () => {
  // 16.03.2026 пн; 21-23 марта + перенос 21 (сб) и 22 (вс) → 23, 24, 25 марта нерабочие
  const due = addWorkingDays(aktau("2026-03-16T09:00:00"), 5);
  assert.ok(due > aktau("2026-03-23T18:00:00"));
  assert.equal(workingDaysBetween(aktau("2026-03-20T12:00:00"), aktau("2026-03-27T12:00:00")) < 5, true);
});

test("SLA: состояние таймера", () => {
  const due = aktau("2026-09-30T18:00:00");
  assert.equal(slaState(due, aktau("2026-09-10T12:00:00")).level, "ok");
  assert.equal(slaState(due, aktau("2026-09-28T12:00:00")).level, "warn");
  assert.equal(slaState(due, aktau("2026-10-01T12:00:00")).level, "danger");
  assert.equal(slaState(due, aktau("2026-10-01T12:00:00")).breached, true);
});

test("SLA: переоткрытие не обнуляет просрочку", () => {
  const original = aktau("2026-09-10T18:00:00");
  const after = slaDueAfterReopen(original, aktau("2026-09-20T10:00:00"));
  assert.ok(after > original);
  const early = slaDueAfterReopen(aktau("2026-12-01T18:00:00"), aktau("2026-09-20T10:00:00"));
  assert.equal(early.toISOString(), aktau("2026-12-01T18:00:00").toISOString());
});

test("Классификатор: ru и kz", () => {
  assert.equal(classify("Огромная яма во дворе, машины бьются").category, "road_pit");
  assert.equal(classify("Третий день нет воды в 3 мкр").category, "water_outage");
  assert.equal(classify("Не горит фонарь у остановки, темно").category, "lighting");
  assert.equal(classify("Мусор не вывозят неделю, контейнеры переполнены").category, "garbage");
  assert.equal(classify("Ночью резкий запах нефти, невозможно дышать").category, "smell");
  assert.equal(classify("Раскопали двор и не восстановили асфальт").category, "excavation");
  assert.equal(classify("Көше жарығы жанбайды, қараңғы").category, "lighting");
  assert.equal(classify("Қоқыс шығарылмайды").category, "garbage");
  assert.equal(classify("Үйде су жоқ").category, "water_outage");
  assert.equal(classify("Водитель автобуса 107 грубит").category, "transport");
  assert.equal(classify("привет").needsManual, true);
});

test("Маршрутизация: яма после раскопок → КЖСА", () => {
  assert.equal(route("road_pit", "Яма на дороге", "roads").service, "roads");
  const r = route("road_pit", "Яма после раскопок КЖСА", "roads");
  assert.equal(r.service, "kzhsa");
  assert.equal(r.rule, "pit-after-excavation");
});

test("Дедупликация: 120 м, та же категория, 30 дней, не закрыто", () => {
  const now = new Date("2026-09-23T10:00:00Z");
  const base = { lat: 43.636106, lng: 51.174662, category_id: 1 };
  const reports = [
    { id: 1, lat: 43.6365, lng: 51.1748, category_id: 1, status: "in_progress", created_at: "2026-09-20T00:00:00Z" }, // ~45 м
    { id: 2, lat: 43.6385, lng: 51.1748, category_id: 1, status: "new", created_at: "2026-09-20T00:00:00Z" }, // ~270 м
    { id: 3, lat: 43.6362, lng: 51.1747, category_id: 2, status: "new", created_at: "2026-09-20T00:00:00Z" }, // другая категория
    { id: 4, lat: 43.6362, lng: 51.1747, category_id: 1, status: "resolved", created_at: "2026-09-20T00:00:00Z" },
    { id: 5, lat: 43.6362, lng: 51.1747, category_id: 1, status: "new", created_at: "2026-07-01T00:00:00Z" }, // старше 30 дней
  ];
  const d = findDuplicates(base, reports, now);
  assert.deepEqual(d.map((x) => x.id), [1]);
  assert.ok(d[0].distance_m < 120);
});

test("Приоритет: слагаемые складываются в итог", () => {
  const p = computePriority({
    severityBase: 55, confirmationWeights: 14, daysInQueue: 15, slaDays: 15,
    nearSocial: true, slaBreached: true, chronicScore: 1, reopenCount: 2,
  });
  // 55 + 12·ln15 (32.5) + 10 + 15 + 20 + 10 + 30
  assert.equal(p.score, 172.5);
  assert.equal(p.terms.length, 7);
});

test("Гео: гаверсинус и точка в полигоне", () => {
  const d = haversine({ lat: 43.65, lng: 51.16 }, { lat: 43.651, lng: 51.16 });
  assert.ok(Math.abs(d - 111.2) < 1);
  const sq = { type: "Polygon" as const, coordinates: [[[51, 43], [52, 43], [52, 44], [51, 44], [51, 43]] as [number, number][]] };
  assert.ok(pointInPolygon({ lat: 43.5, lng: 51.5 }, sq));
  assert.ok(!pointInPolygon({ lat: 44.5, lng: 51.5 }, sq));
});

test("Классификатор: общие ru/kz основы не удваивают вес", () => {
  const c = classify("Яма во дворе после раскопок, асфальт не восстановили");
  assert.equal(c.category, "excavation");
  assert.equal(c.scores.road_pit, 5);
});

test("Приоритет: время в очереди ограничено сроком (не удваивает просрочку)", () => {
  const base = { severityBase: 55, confirmationWeights: 0, slaDays: 15, nearSocial: false, slaBreached: true, chronicScore: 0, reopenCount: 0 };
  assert.equal(computePriority({ ...base, daysInQueue: 175 }).score, computePriority({ ...base, daysInQueue: 15 }).score);
});

import { painIndex } from "../lib/pain-index";
test("Индекс боли: нормировка на население, закрытые ×0.3, мало данных", () => {
  const now = new Date("2026-09-23T12:00:00Z").getTime();
  const base = { demo: true, service: "roads", title: "", title_kz: null, lat: 0, lng: 0, accepted_at: null, sla_due_at: "", sla_breached: false, reopen_count: 0, confirmations: 0, after_geo_verified: null, reply_boilerplate: null, source: "app", public_no: "" };
  const mk = (id: number, district: string, priority: number, status: string, resolved_at: string | null = null) => ({
    ...base, id, district, priority, status, resolved_at, category: "road_pit", created_at: "2026-09-10T00:00:00Z",
  });
  const reports = [
    ...[1, 2, 3, 4, 5].map((i) => mk(i, "a", 100, "routed")), // A: 500 баллов открыто
    ...[6, 7, 8, 9].map((i) => mk(i, "b", 100, "routed")), //       B: 400 открыто
    mk(10, "b", 100, "resolved", "2026-09-20T00:00:00Z"), //         B: +0.3×100 закрыто недавно
    mk(11, "c", 100, "routed"), //                                   C: 1 обращение — мало данных
  ];
  const rows = painIndex(reports, [{ code: "a", population: 10000 }, { code: "b", population: 2000 }, { code: "c", population: 1000 }], now);
  const a = rows.find((r) => r.district === "a")!, b = rows.find((r) => r.district === "b")!, c = rows.find((r) => r.district === "c")!;
  assert.equal(a.raw, 50); //  500 / 10 тыс.
  assert.equal(b.raw, 215); // (400 + 30) / 2 тыс. — меньший район с меньшим числом жалоб «болит» сильнее
  assert.equal(b.index, 100);
  assert.equal(a.index, 23);
  assert.equal(c.insufficient, true);
  assert.equal(c.index, null);
});
