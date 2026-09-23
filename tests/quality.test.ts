// Проверка обращений: мусор отсекается, нормальные жалобы (ru/kz) проходят. Запуск: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { textChecks, photoChecks, worst } from "../lib/report-quality";
import { demoBaseline } from "../lib/demo-baseline";

test("бессмыслица и мат не проходят", () => {
  for (const t of ["фывапролд", "ааааааа", "пврлджфк гшщзх", "asdfgh", "123 !!!", "ну ты сука"]) assert.equal(worst(textChecks(t)), "fail", t);
});

test("все реальные формулировки обращений (ru и kz) проходят без отказа", () => {
  const titles = new Set(demoBaseline().flatMap((r) => [r.title, r.title_kz ?? r.title]));
  for (const t of titles) assert.notEqual(worst(textChecks(t)), "fail", t);
  for (const t of ["Яма на дороге во дворе", "Нет воды второй день", "Мусор не вывозят", "3 мкр, д. 111: асфальт после раскопок", "Аулада шұңқыр", "Су жоқ"]) assert.notEqual(worst(textChecks(t)), "fail", t);
});

test("пустое, чёрное и засвеченное фото не проходит; обычное — проходит", () => {
  assert.equal(worst(photoChecks({ stats: { mean: 120, std: 3, sharp: 1 } })), "fail");
  assert.equal(worst(photoChecks({ stats: { mean: 10, std: 9, sharp: 5 } })), "fail");
  assert.equal(worst(photoChecks({ stats: { mean: 250, std: 9, sharp: 5 } })), "fail");
  assert.equal(worst(photoChecks({ stats: { mean: 118, std: 52, sharp: 40 } })), "ok");
});
