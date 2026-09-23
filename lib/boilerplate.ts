// ФИШКА 3: детектор ответов без конкретики. Свой и объяснимый метод, 0..1.
//
// score = 0.40 · маркеры шаблонных фраз (насыщение на 3 маркерах)
//       + 0.35 · max TF-IDF косинусное сходство с корпусом типовых шаблонных ответов
//       + 0.25 · доля отсутствующей конкретики из 4: дата/срок, сумма, исполнитель, ссылка на документ
//
// В интерфейсе называем это «ответ без конкретики», а не «отписка».

import { normalize } from "./classify";

const MARKERS = [
  "включено в план", "включен в план", "будет включен", "проводится работа", "ведется работа", "ведутся работы",
  "будет рассмотрен", "будет рассмотрено", "по мере выделения", "по мере финансирования", "принято к сведению",
  "взято на контроль", "находится на контроле", "в рабочем порядке", "в ближайшее время", "по возможности",
  "решается вопрос", "прорабатывается", "направлен запрос", "будут приняты меры", "примем меры",
  "в установленном порядке", "в соответствии с законодательством",
  "жоспарға енгізілді", "жұмыс жүргізілуде", "қаралатын болады", "бақылауда",
];

// Корпус типовых шаблонных формулировок (обобщённые, без привязки к конкретным службам)
const CORPUS = [
  "ваше обращение рассмотрено вопрос включен в план работ на следующий год",
  "по вашему обращению проводится работа о результатах будет сообщено дополнительно",
  "ремонт будет произведен по мере выделения бюджетных средств",
  "информация принята к сведению вопрос взят на контроль",
  "данный вопрос находится на контроле работы будут проведены в ближайшее время",
  "в настоящее время решается вопрос о выделении финансирования",
  "направлен запрос в соответствующие органы ответ будет направлен в установленном порядке",
  "будут приняты меры в рамках компетенции",
  "работы по благоустройству будут проведены в рамках бюджетной программы",
  "обращение рассмотрено разъяснено в соответствии с законодательством",
];

const tokenize = (t: string) => normalize(t).split(" ").filter((w) => w.length > 2);

// IDF по корпусу (+1 сглаживание), вектор TF-IDF
const DF = new Map<string, number>();
for (const doc of CORPUS) for (const w of new Set(tokenize(doc))) DF.set(w, (DF.get(w) ?? 0) + 1);
const idf = (w: string) => Math.log((CORPUS.length + 1) / ((DF.get(w) ?? 0) + 1)) + 1;

function vec(text: string) {
  const tf = new Map<string, number>();
  for (const w of tokenize(text)) tf.set(w, (tf.get(w) ?? 0) + 1);
  const v = new Map<string, number>();
  for (const [w, c] of tf) v.set(w, c * idf(w));
  return v;
}
function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0, na = 0, nb = 0;
  for (const [, x] of a) na += x * x;
  for (const [, y] of b) nb += y * y;
  for (const [w, x] of a) dot += x * (b.get(w) ?? 0);
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
const CORPUS_VECS = CORPUS.map(vec);

// Признаки конкретики
const SPECIFICS = {
  date: /\b\d{1,2}[./]\d{1,2}([./]\d{2,4})?\b|\bдо \d{1,2} (январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр)|\b\d{1,2} (январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр)|\b(завтра|сегодня|в течение \d+)/i,
  amount: /\d[\d\s]*(тг|тенге|₸|млн|тыс)/i,
  executor: /\b(тоо|ип|ао|гкп|бригад|подрядчик|мастер|инженер)\b|«[^»]+»/i,
  document: /(№\s*\d+|договор|приказ|письм|акт выполненных|наряд)/i,
};

export type BoilerplateResult = {
  score: number;
  markers: string[];
  similarity: number;
  missing: (keyof typeof SPECIFICS)[];
};

export function boilerplateScore(text: string): BoilerplateResult {
  const norm = normalize(text);
  const markers = MARKERS.filter((m) => norm.includes(m));
  const v = vec(text);
  const similarity = Math.max(0, ...CORPUS_VECS.map((c) => cosine(v, c)));
  const missing = (Object.keys(SPECIFICS) as (keyof typeof SPECIFICS)[]).filter((k) => !SPECIFICS[k].test(text));
  const score = 0.4 * Math.min(1, markers.length / 3) + 0.35 * similarity + 0.25 * (missing.length / 4);
  return { score: Math.round(score * 100) / 100, markers, similarity: Math.round(similarity * 100) / 100, missing };
}

export const BOILERPLATE_THRESHOLD = 0.55;
