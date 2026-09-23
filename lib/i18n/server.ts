import "server-only";
import { cookies } from "next/headers";
import { DICTS, type Lang } from "./dict";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value;
  return v === "kz" ? "kz" : "ru";
}

export async function getDict() {
  const lang = await getLang();
  return { lang, t: DICTS[lang] };
}
