// Детерминированная демо-подложка (ТЗ, раздел 11): ~850 обращений за 90 дней,
// посаженных на РЕАЛЬНЫЕ микрорайоны (полигоны OSM), реальные службы и категории.
//
// Правила:
//  - фиксированный seed → одинаковый результат при каждом запуске в течение дня;
//  - id отрицательные, public_no «DEMO-…», поле demo=true — не спутать с реальными;
//  - вероятности просрочек, переоткрытий и шаблонных ответов ОДИНАКОВЫ для всех служб:
//    синтетика не должна создавать впечатление, что конкретная реальная организация
//    работает хуже. Различия между службами появляются только из реальных обращений;
//  - хронические узлы — только из реальных кейсов прессы (data/press_cases.json);
//  - сезонность: вода и запах — лето, отопление — зима.

import districtsData from "@/data/districts.normalized.json";
import populationData from "@/data/population.json";
import categoriesData from "@/data/categories.json";
import { pointInPolygon, destination, type GeoPolygon, type LatLng } from "./geo";
import { slaDueAt, TZ_OFFSET_H } from "./sla";
import { computePriority } from "./priority";

export type BaseReport = {
  id: number;
  public_no: string;
  demo: boolean;
  category: string;
  service: string;
  district: string | null;
  title: string;
  title_kz: string | null; // казахский вариант (только у демо-записей; тексты жителей не переводим)
  lat: number;
  lng: number;
  status: string;
  created_at: string;
  accepted_at: string | null;
  resolved_at: string | null;
  sla_due_at: string;
  sla_breached: boolean;
  reopen_count: number;
  confirmations: number;
  priority: number;
  after_geo_verified: boolean | null;
  reply_boilerplate: number | null;
  source: string;
};

// mulberry32 — маленький детерминированный ГПСЧ
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type D = { code: string; kind: string; center_lat: number; center_lng: number; polygon: GeoPolygon | null };
const DISTRICTS = (districtsData.items as D[]).filter((d) => d.kind === "mkr" && d.polygon);
const CATS = categoriesData.items;
const CAT_BY = Object.fromEntries(CATS.map((c) => [c.code, c]));

// Поток жалоб пропорционален оценке населения района (scripts/estimate-population.mjs):
// больше людей — больше обращений. Районы, по которым в прессе много жалоб, — с повышающим весом.
const POPULATION: Record<string, number> = Object.fromEntries(populationData.items.map((p) => [p.code, p.population_est]));
const PRESS_WEIGHT: Record<string, number> = { "mkr-3": 1.8, "mkr-15": 1.6, "mkr-20": 1.5, "mkr-14": 1.3, "mkr-19": 1.2, "mkr-30": 1.2, "mkr-34": 1.2, "mkr-35": 1.2 };

// Доля категорий в потоке и сезонный множитель по месяцу (1..12)
const CAT_SHARE: Record<string, number> = {
  road_pit: 22, excavation: 8, water_outage: 11, sewage: 6, heating: 5, power_outage: 8,
  lighting: 9, garbage: 14, smell: 5, yard: 6, transport: 3, beach: 2, other: 1,
};
const season = (cat: string, month: number) => {
  const summer = month >= 6 && month <= 9;
  const winter = month <= 3 || month >= 11;
  if (cat === "heating") return winter ? 3 : month === 10 || month === 4 ? 1 : 0.05;
  if (cat === "water_outage" || cat === "smell" || cat === "beach") return summer ? 1.8 : 0.6;
  if (cat === "road_pit") return winter || month === 4 ? 1.4 : 1;
  return 1;
};

// Пары [ru, kz]
const TITLES: Record<string, [string, string][]> = {
  road_pit: [["Яма на проезжей части во дворе", "Аула ішіндегі жолда шұңқыр"], ["Разбитый асфальт у подъезда", "Кіреберіс алдындағы асфальт бұзылған"], ["Глубокая выбоина на дороге", "Жолда терең шұңқыр"], ["Просадка покрытия на въезде во двор", "Аулаға кіреберісте жабын отырып кеткен"]],
  excavation: [["После раскопок не восстановили асфальт", "Қазбадан кейін асфальт қалпына келтірілмеген"], ["Разрытая траншея во дворе", "Аулада қазылған траншея"], ["Двор перекопан и брошен", "Аула қазылып, тастап кетілген"]],
  water_outage: [["Нет воды второй день", "Екінші күн су жоқ"], ["Из крана идёт техническая вода", "Краннан техникалық су ағады"], ["Слабый напор воды", "Су қысымы әлсіз"], ["Ржавая вода из крана", "Краннан тот басқан су ағады"]],
  sewage: [["Прорыв канализации у дома", "Үй жанында кәріз жарылды"], ["Течь в подвале", "Жертөледе су ағып жатыр"], ["Открытый канализационный люк", "Кәріз люгі ашық тұр"]],
  heating: [["Холодные батареи", "Батареялар суық"], ["Нет отопления в подъезде", "Кіреберісте жылу жоқ"]],
  power_outage: [["Отключили свет без предупреждения", "Ескертусіз жарық өшірілді"], ["Нет электричества в доме", "Үйде электр қуаты жоқ"], ["Скачки напряжения", "Кернеу ауытқуы"]],
  lighting: [["Не горят фонари во дворе", "Аулада шамдар жанбайды"], ["Темно на пешеходной дорожке", "Жаяу жүргінші жолында қараңғы"], ["Не работает освещение у остановки", "Аялдама жанындағы жарық істемейді"]],
  garbage: [["Мусор не вывозят несколько дней", "Қоқыс бірнеше күн шығарылмайды"], ["Переполнены контейнеры", "Контейнерлер толып кеткен"], ["Стихийная свалка у дома", "Үй жанында стихиялық қоқыс үйіндісі"]],
  smell: [["Резкий запах ночью", "Түнде өткір иіс"], ["Химический запах в районе", "Ауданда химиялық иіс"], ["Запах нефтепродуктов", "Мұнай өнімдерінің иісі"]],
  yard: [["Сломана детская площадка", "Балалар алаңы сынған"], ["Нужно благоустройство двора", "Аулаға абаттандыру қажет"], ["Разбитые скамейки", "Орындықтар сынған"]],
  transport: [["Автобус не приходит по расписанию", "Автобус кесте бойынша келмейді"], ["Нет остановочного павильона", "Аялдама павильоны жоқ"]],
  beach: [["Мусор на пляже", "Жағажайда қоқыс"], ["Нет контейнеров на побережье", "Жағалауда контейнерлер жоқ"]],
  other: [["Прочая городская проблема", "Басқа қалалық мәселе"]],
};

// Типовые ответы: часть конкретные, часть шаблонные. Выбор НЕ зависит от службы.
const REPLIES_SPECIFIC = [0.18, 0.22, 0.25, 0.3];
const REPLIES_BOILER = [0.62, 0.7, 0.78, 0.85];

// Реальные хронические точки из прессы → плотные узлы
type Hotspot = { center: LatLng; category: string; n: number; spreadM: number; spanDays: number; reopenBias: number; title: [string, string] };
const HOTSPOTS: Hotspot[] = [
  { center: { lat: 43.636106, lng: 51.174662 }, category: "excavation", n: 16, spreadM: 45, spanDays: 88, reopenBias: 0.5, title: ["3 мкр, д. 111: асфальт после раскопок не восстановлен", "3 шағын аудан, 111 үй: қазбадан кейін асфальт қалпына келтірілмеген"] },
  { center: { lat: 43.659957, lng: 51.139315 }, category: "road_pit", n: 12, spreadM: 50, spanDays: 80, reopenBias: 0.3, title: ["15 мкр, д. 64–66: разбитая дорога внутри квартала", "15 шағын аудан, 64–66 үйлер: квартал ішіндегі жол бұзылған"] },
  { center: { lat: 43.6378, lng: 51.1805 }, category: "water_outage", n: 11, spreadM: 70, spanDays: 20, reopenBias: 0.1, title: ["3 мкр: нет питьевой воды, из крана техническая", "3 шағын аудан: ауыз су жоқ, краннан техникалық су ағады"] },
  { center: { lat: 43.6803, lng: 51.1623 }, category: "smell", n: 9, spreadM: 250, spanDays: 60, reopenBias: 0, title: ["30 мкр: ночью резкий запах", "30 шағын аудан: түнде өткір иіс"] },
  { center: { lat: 43.6885, lng: 51.1631 }, category: "smell", n: 8, spreadM: 250, spanDays: 60, reopenBias: 0, title: ["34 мкр: едкий запах", "34 шағын аудан: ащы иіс"] },
  { center: { lat: 43.6960, lng: 51.1740 }, category: "smell", n: 7, spreadM: 250, spanDays: 60, reopenBias: 0, title: ["35 мкр: запах нефтепродуктов", "35 шағын аудан: мұнай өнімдерінің иісі"] },
  { center: { lat: 43.6833, lng: 51.1427 }, category: "power_outage", n: 9, spreadM: 150, spanDays: 70, reopenBias: 0.2, title: ["20 мкр: частые отключения света", "20 шағын аудан: жарық жиі өшеді"] },
];

function pointInDistrict(d: D, r: () => number): LatLng {
  const poly = d.polygon!;
  const ring = poly.type === "Polygon" ? poly.coordinates[0] : poly.coordinates[0][0];
  const lngs = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
  const [minLng, maxLng, minLat, maxLat] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
  for (let i = 0; i < 30; i++) {
    const p = { lat: minLat + r() * (maxLat - minLat), lng: minLng + r() * (maxLng - minLng) };
    if (pointInPolygon(p, poly)) return p;
  }
  return { lat: d.center_lat, lng: d.center_lng };
}

function pick<T>(items: T[], weights: number[], r: () => number): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let x = r() * total;
  for (let i = 0; i < items.length; i++) if ((x -= weights[i]) <= 0) return items[i];
  return items[items.length - 1];
}

function districtOf(p: LatLng): string | null {
  return DISTRICTS.find((d) => pointInPolygon(p, d.polygon!))?.code ?? null;
}

function build(anchor: Date): BaseReport[] {
  const r = rng(20260923);
  const out: BaseReport[] = [];
  const DAYS = 90;
  const TARGET = 760;

  const make = (created: Date, cat: string, p: LatLng, title: [string, string], reopenBias: number) => {
    const c = CAT_BY[cat];
    const ageDays = (anchor.getTime() - created.getTime()) / 86400_000;
    const due = slaDueAt(created, c.sla_days);
    // Судьба обращения: чем старше, тем вероятнее закрыто. Вероятности одинаковы для всех служб.
    const u = r();
    let status: string;
    let accepted: Date | null = null;
    let resolved: Date | null = null;
    let reopen = 0;
    const pDone = Math.min(0.88, 0.1 + ageDays / 40);
    if (u < pDone) {
      const took = 2 + r() * (r() < 0.75 ? 14 : 30); // дней до решения; ~четверть — дольше срока
      accepted = new Date(created.getTime() + (0.2 + r() * 2) * 86400_000);
      resolved = new Date(created.getTime() + took * 86400_000);
      if (resolved > anchor) {
        status = r() < 0.5 ? "in_progress" : "awaiting_confirmation";
        resolved = null;
      } else status = "resolved";
      if (r() < 0.08 + reopenBias) reopen = 1 + (r() < 0.3 + reopenBias ? 1 : 0);
    } else if (u < pDone + 0.03) {
      status = "rejected";
      resolved = null;
    } else {
      status = pick(["routed", "accepted", "in_progress", "reopened"], [3, 2, 3, reopenBias > 0 ? 3 : 0.5], r);
      if (status !== "routed") accepted = new Date(created.getTime() + (0.3 + r() * 3) * 86400_000);
      if (status === "reopened") reopen = 1 + (r() < 0.3 ? 1 : 0);
    }
    const end = resolved ?? anchor;
    const breached = status !== "rejected" && end > due;
    const confirmations = Math.floor(r() ** 2.2 * 18) + (reopenBias > 0 ? 3 : 0);
    const { score } = computePriority({
      severityBase: c.severity_base,
      confirmationWeights: confirmations,
      daysInQueue: ageDays,
      slaDays: c.sla_days,
      nearSocial: r() < 0.22,
      slaBreached: breached,
      chronicScore: reopenBias > 0 ? 0.8 : 0,
      reopenCount: reopen,
    });
    const hasReply = status !== "routed" && r() < 0.8;
    const replyScore = hasReply ? (r() < 0.35 ? REPLIES_BOILER : REPLIES_SPECIFIC)[Math.floor(r() * 4)] : null;
    const idx = out.length + 1;
    out.push({
      id: -idx,
      public_no: `DEMO-${String(idx).padStart(4, "0")}`,
      demo: true,
      category: cat,
      service: c.default_service === "roads" && cat === "excavation" ? "kzhsa" : c.default_service,
      district: districtOf(p),
      title: title[0],
      title_kz: title[1],
      lat: +p.lat.toFixed(6),
      lng: +p.lng.toFixed(6),
      status,
      created_at: created.toISOString(),
      accepted_at: accepted?.toISOString() ?? null,
      resolved_at: resolved?.toISOString() ?? null,
      sla_due_at: due.toISOString(),
      sla_breached: breached,
      reopen_count: reopen,
      confirmations,
      priority: score,
      after_geo_verified: status === "resolved" || status === "awaiting_confirmation" ? r() < 0.78 : null,
      reply_boilerplate: replyScore,
      source: pick(["app", "call109", "operator", "instagram"], [6, 3, 1, 1], r),
    });
  };

  // Фоновый поток
  const districtWeights = DISTRICTS.map((d) => Math.max(POPULATION[d.code] ?? 0, 300) * (PRESS_WEIGHT[d.code] ?? 1));
  const catCodes = Object.keys(CAT_SHARE);
  for (let i = 0; i < TARGET; i++) {
    const created = new Date(anchor.getTime() - r() * DAYS * 86400_000);
    const month = new Date(created.getTime() + TZ_OFFSET_H * 3600_000).getUTCMonth() + 1;
    const cat = pick(catCodes, catCodes.map((c) => CAT_SHARE[c] * season(c, month)), r);
    const d = pick(DISTRICTS, districtWeights, r);
    const titles = TITLES[cat];
    make(created, cat, pointInDistrict(d, r), titles[Math.floor(r() * titles.length)], 0);
  }

  // Узлы из реальных кейсов прессы
  for (const h of HOTSPOTS) {
    for (let i = 0; i < h.n; i++) {
      const created = new Date(anchor.getTime() - (2 + r() * h.spanDays) * 86400_000);
      // Запах — ночью (22:00–04:00 по Актау), как в публикациях
      if (h.category === "smell") created.setUTCHours((22 - TZ_OFFSET_H + Math.floor(r() * 6)) % 24);
      const p = destination(h.center, r() * 360, r() * h.spreadM);
      make(created, h.category, p, h.title, h.reopenBias);
    }
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// Якорь — начало текущих суток по Актау: в течение дня подложка неизменна
let cache: { day: string; data: BaseReport[] } | null = null;
export function demoBaseline(now = new Date()): BaseReport[] {
  const local = new Date(now.getTime() + TZ_OFFSET_H * 3600_000);
  const day = local.toISOString().slice(0, 10);
  if (cache?.day !== day) {
    const anchor = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TZ_OFFSET_H * 3600_000 + 12 * 3600_000);
    cache = { day, data: build(anchor < now ? anchor : now) };
  }
  return cache.data;
}
