// Привязка лота к микрорайонам по тексту: «микрорайонов 14 и 22», «19 а, 20, 20 а мкр»,
// «в 37, 38 микрорайонах», «Шыгыс-2,3», «35 шағынауданында». Возвращает коды districts.
const KEY = /(мкр\.?|мкрн\.?|микрорайон[а-я]*|шағын\s*аудан[а-я]*|шағынаудан[а-я]*)/gi;
const NUM = /(?<!№\s?)(?<![\d.,])(\d{1,2})(?:\s*[-]?\s*([аА]))?(?![\d.,]*\s*(?:км|м\b|шт|штук|%|мм|кв|тенге|тг|год|дом|д\.))/g;

export function districtCodes(text, known) {
  const out = new Set();
  // именованные массивы вырезаем до разбора чисел, иначе «Шыгыс-2» даст ещё и «2 мкр»
  const t = text.replace(/\s+/g, " ").replace(/(Шыгыс|Самал|Толкын)[-\s]?\d(?:\s*,\s*\d)?/gi, "$1");
  const raw = text.replace(/\s+/g, " ");
  for (const m of t.matchAll(KEY)) {
    // числа в окне вокруг слова «микрорайон»: до 28 символов до и 18 после
    const before = t.slice(Math.max(0, m.index - 28), m.index);
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 18);
    for (const part of [before.split(/[«»"()]|\bи\s+в\b/).pop(), after.split(/[«»"(),.]|\bгород|\bг\./)[0]]) {
      for (const n of part.matchAll(NUM)) {
        const code = `mkr-${Number(n[1])}${n[2] ? "a" : ""}`;
        if (known.has(code)) out.add(code);
      }
    }
  }
  // именованные жилые массивы
  const named = [
    [/Шыгыс[-\s]?(\d)(?:\s*,\s*(\d))?/i, (m) => [m[1], m[2]].filter(Boolean).map((x) => `shygys-${x}`)],
    [/Самал[-\s]?(\d)?/i, (m) => [m[1] ? `samal-${m[1]}` : "samal"]],
    [/Толкын[-\s]?(\d)?/i, (m) => [m[1] ? `tolkyn-${m[1]}` : "tolkyn"]],
  ];
  for (const [rx, f] of named) {
    const m = raw.match(rx);
    if (m) for (const c of f(m)) if (known.has(c)) out.add(c);
  }
  // дорога через пять и больше микрорайонов — общегородской объект, не делим по районам
  return out.size > 4 ? [] : [...out];
}
