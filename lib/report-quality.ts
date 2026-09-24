// Проверка обращения перед отправкой — чтобы в систему не попадал мусор.
// Работает без интернета и без внешних ключей; одни и те же правила — в браузере
// (мгновенная подсказка жителю) и на сервере (обойти проверку из консоли нельзя).
//
//  • текст: бессмыслица («фывапролд», «ааааа»), нецензурные слова, слишком мало слов,
//    не похоже на городскую проблему (классификатор не узнаёт ни одной категории);
//  • фото: пустой/чёрный/засвеченный кадр, сильное размытие (по яркости и резкости пикселей),
//    старое фото, геометка далеко от точки.
// Уровни: fail — отправить нельзя; warn — можно, но житель видит замечание; ok — пройдено.

import { classify } from "@/lib/classify";

export type Level = "ok" | "warn" | "fail";
export type Check = { id: CheckId; level: Level; vars?: Record<string, string | number> };
export type CheckId =
  | "text_ok" | "text_gibberish" | "text_profanity" | "text_short" | "text_offtopic"
  | "photo_ok" | "photo_none" | "photo_empty" | "photo_dark" | "photo_bright" | "photo_blurry" | "photo_old" | "photo_far"
  | "place_ok" | "place_none"
  | "ai_ok" | "ai_not_problem" | "ai_injection" | "ai_screen"
  | "rate_limit" | "repeat_here";

/** Яркость/контраст/резкость фото — считаются в браузере по уменьшенной копии */
export type PhotoStats = { mean: number; std: number; sharp: number };

const VOWELS = /[аеёиоуыэюяәіөұүaeiouy]/g;
const LETTERS = /[a-zа-яёәғқңөұүһі]/g;
// Основы нецензурной лексики (достаточно для фильтра; список намеренно короткий)
const PROFANE = /(^|[^a-zа-яё])(ху[йеёияю]|пизд|еба[нлт]|ёба|ебу|бля[дт]?|сук[аи]|мудак|долбо[её]б|гандон|пидор|шлюх)/i;
const KEYBOARD = ["йцукен", "фывап", "ячсмит", "qwert", "asdfg", "zxcvb", "олдж", "ролд"];

/** Похоже ли слово/текст на набор случайных букв */
export function isGibberish(text: string) {
  const t = text.toLowerCase().replace(/ё/g, "е");
  const letters = t.match(LETTERS)?.length ?? 0;
  if (letters < 3) return true;
  if (/(.)\1{4,}/.test(t)) return true; // «ааааааа»
  if (KEYBOARD.some((k) => t.includes(k))) return true;
  const vowels = t.match(VOWELS)?.length ?? 0;
  const ratio = vowels / letters;
  if (ratio < 0.18 || ratio > 0.8) return true;
  // длинные цепочки согласных без гласных («пврлджфк»)
  if (/[бвгджзйклмнпрстфхцчшщғқңһ]{6,}/.test(t)) return true;
  return false;
}

export function textChecks(title: string, description = ""): Check[] {
  const full = `${title} ${description}`.trim();
  const words = full.split(/\s+/).filter((w) => /[a-zа-яёәғқңөұүһі]{2,}/i.test(w));
  if (!title.trim()) return [];
  if (PROFANE.test(full)) return [{ id: "text_profanity", level: "fail" }];
  // бессмыслица: если больше половины слов — случайные наборы букв
  const junk = words.filter((w) => w.length >= 4 && isGibberish(w)).length;
  if (words.length === 0 || isGibberish(full) || junk > words.length / 2) return [{ id: "text_gibberish", level: "fail" }];
  const out: Check[] = [];
  if (words.length < 3) out.push({ id: "text_short", level: "warn" });
  const c = classify(full);
  if (c.matched.length === 0) out.push({ id: "text_offtopic", level: "warn" });
  if (!out.length) out.push({ id: "text_ok", level: "ok" });
  return out;
}

export function photoChecks(p: { stats?: PhotoStats | null; taken_at?: string | null; lat?: number | null; lng?: number | null } | null, point?: { lat: number; lng: number } | null, now = new Date()): Check[] {
  if (!p) return [{ id: "photo_none", level: "warn" }];
  const out: Check[] = [];
  const s = p.stats;
  if (s) {
    if (s.std < 7) out.push({ id: "photo_empty", level: "fail" });
    else if (s.mean < 22) out.push({ id: "photo_dark", level: "fail" });
    else if (s.mean > 240) out.push({ id: "photo_bright", level: "fail" });
    else if (s.sharp < 12) out.push({ id: "photo_blurry", level: "warn" });
  }
  if (p.taken_at) {
    const days = (now.getTime() - new Date(p.taken_at).getTime()) / 86_400_000;
    if (days > 30) out.push({ id: "photo_old", level: "warn", vars: { n: Math.round(days) } });
  }
  if (point && p.lat != null && p.lng != null) {
    const d = distM(point, { lat: p.lat, lng: p.lng });
    if (d > 300) out.push({ id: "photo_far", level: "warn", vars: { n: Math.round(d) } });
  }
  if (!out.length) out.push({ id: "photo_ok", level: "ok" });
  return out;
}

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const worst = (checks: Check[]): Level => (checks.some((c) => c.level === "fail") ? "fail" : checks.some((c) => c.level === "warn") ? "warn" : "ok");

/** Яркость, контраст и резкость картинки по уменьшенной копии (только в браузере) */
export async function measurePhoto(blob: Blob): Promise<PhotoStats | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const W = 160;
    const H = Math.max(1, Math.round((bmp.height / bmp.width) * W));
    // OffscreenCanvas в Safari только с iOS 16.4 — на старых айфонах обычный canvas
    const cv: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H });
    const ctx = cv.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const g = new Float32Array(W * H);
    let sum = 0;
    for (let i = 0; i < W * H; i++) {
      g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      sum += g[i];
    }
    const mean = sum / g.length;
    let v = 0;
    for (const x of g) v += (x - mean) ** 2;
    // резкость — дисперсия лапласиана: у размытого кадра почти нет перепадов
    let lap = 0;
    let n = 0;
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - W] - g[i + W];
        lap += l * l;
        n++;
      }
    return { mean: Math.round(mean), std: Math.round(Math.sqrt(v / g.length)), sharp: Math.round(Math.sqrt(lap / Math.max(n, 1))) };
  } catch {
    return null;
  }
}
