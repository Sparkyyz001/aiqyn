// Словарь интерфейса ru / kz. Госпродукт — двуязычность обязательна (ТЗ, раздел 9).
// Язык хранится в cookie `lang` (настройка интерфейса, не данные).
import { ru, type Dict } from "./ru";
import { kz } from "./kz";

export type Lang = "ru" | "kz";
export const LANGS: Lang[] = ["ru", "kz"];

export const DICTS: Record<Lang, Dict> = { ru, kz };
export type { Dict };

// Название сущности из справочника в нужной локали
export const nameOf = (x: { name_ru: string; name_kz: string }, lang: Lang) =>
  lang === "kz" ? x.name_kz : x.name_ru;

/** Подстановка {name} в строку словаря */
export const fmt = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
