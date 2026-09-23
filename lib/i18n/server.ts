import "server-only";
import { cookies } from "next/headers";
import { DICTS, fmt, type Dict, type Lang } from "./dict";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value;
  return v === "kz" ? "kz" : "ru";
}

export async function getDict() {
  const lang = await getLang();
  return { lang, t: DICTS[lang] };
}

/** Сообщение об ошибке на языке пользователя (для серверных экшенов) */
export async function msg(key: keyof Dict["errors"], vars?: Record<string, string | number>) {
  const { t } = await getDict();
  return vars ? fmt(t.errors[key], vars) : t.errors[key];
}
