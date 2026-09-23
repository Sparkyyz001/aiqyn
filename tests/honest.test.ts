// «Честный срок»: паритет TypeScript ↔ Python и честное поведение прогноза. Запуск: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import model from "../data/honest_deadline_model.json";
import { honestContext, honestForecast, nycPredictLog, MIN_SIMILAR, type HonestReport } from "../lib/honest-deadline";

test("паритет: TypeScript выдаёт то же, что обученная в Python модель", () => {
  assert.ok(model.test_vectors.length >= 20);
  for (const v of model.test_vectors) {
    const got = nycPredictLog(v);
    assert.ok(Math.abs(got - v.expected_log) < 1e-4, `${v.category}/${v.district}/${v.month}: ${got} ≠ ${v.expected_log}`);
  }
});

const DAY = 86_400_000;
const at = (d: number) => new Date(Date.UTC(2026, 5, 1) + d * DAY).toISOString();
function history(cat: string, n: number, took: number): HonestReport[] {
  return Array.from({ length: n }, (_, i) => ({
    id: -(i + 1), category: cat, service: "roads", district: "mkr-3", status: "resolved",
    created_at: at(i), resolved_at: at(i + took), sla_due_at: at(i + 21),
  }));
}

test("мало похожих решённых — прогноз честно не показываем", () => {
  const ctx = honestContext(history("road_pit", MIN_SIMILAR - 1, 10));
  const f = honestForecast({ id: 1, category: "road_pit", service: "roads", district: "mkr-3", status: "routed", created_at: at(100), resolved_at: null, sla_due_at: at(121) }, ctx, new Date(at(100)));
  assert.equal(f.ok, false);
});

test("прогноз — интервал вокруг ожидаемой даты, и тем позже, чем дольше решают похожие", () => {
  const now = new Date(at(100));
  const r = { id: 1, category: "road_pit", service: "roads", district: "mkr-3", status: "routed", created_at: at(100), resolved_at: null, sla_due_at: at(121) };
  const fast = honestForecast(r, honestContext(history("road_pit", 80, 5)), now);
  const slow = honestForecast(r, honestContext(history("road_pit", 80, 60)), now);
  assert.ok(fast.ok && slow.ok);
  if (!fast.ok || !slow.ok) return;
  assert.ok(fast.lo <= fast.date && fast.date <= fast.hi);
  assert.ok(slow.days > fast.days);
  assert.ok((slow.pBreach ?? 0) > (fast.pBreach ?? 0));
});

test("уже просроченная заявка — вероятность срыва 100%, прогноз не раньше сегодняшнего дня", () => {
  const ctx = honestContext(history("road_pit", 80, 10));
  const now = new Date(at(150));
  const f = honestForecast({ id: 1, category: "road_pit", service: "roads", district: "mkr-3", status: "in_progress", created_at: at(100), resolved_at: null, sla_due_at: at(121) }, ctx, now);
  assert.ok(f.ok);
  if (!f.ok) return;
  assert.equal(f.pBreach, 1);
  assert.ok(new Date(f.date).getTime() >= now.getTime() - DAY);
});

test("заявка висит дольше почти всех похожих — прогноз позже сегодняшнего дня, риск согласован с прогнозом", () => {
  const ctx = honestContext(history("road_pit", 80, 10));
  const now = new Date(at(119)); // срок — день 121, открыта с дня 100: уже дольше, чем решали все похожие
  const f = honestForecast({ id: 1, category: "road_pit", service: "roads", district: "mkr-3", status: "in_progress", created_at: at(100), resolved_at: null, sla_due_at: at(121) }, ctx, now);
  assert.ok(f.ok);
  if (!f.ok) return;
  assert.ok(new Date(f.date).getTime() > now.getTime());
  if (f.pBreach! > 0.5) assert.ok((f.lateBy ?? 0) >= 0, "высокий риск срыва, а прогноз раньше срока");
});
