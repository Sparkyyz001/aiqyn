// Метаданные для UI (безопасно для клиента): категории, службы, статусы, цвета.
import categoriesData from "@/data/categories.json";
import servicesData from "@/data/services.json";
import districtsData from "@/data/districts.normalized.json";
import type { Lang } from "@/lib/i18n/dict";

export const CATEGORIES = categoriesData.items;
export const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.code, c])) as Record<string, (typeof CATEGORIES)[number]>;

export const SERVICES = servicesData.items;
export const SERVICE = Object.fromEntries(SERVICES.map((s) => [s.code, s])) as Record<string, (typeof SERVICES)[number]>;

type DistrictLite = { code: string; name_ru: string; name_kz: string; kind: string };
export const DISTRICTS: DistrictLite[] = districtsData.items.map(({ code, name_ru, name_kz, kind }) => ({ code, name_ru, name_kz, kind }));
export const DISTRICT = Object.fromEntries(DISTRICTS.map((d) => [d.code, d])) as Record<string, DistrictLite>;

export const nm = (x: { name_ru: string; name_kz: string } | undefined, lang: Lang) => (x ? (lang === "kz" ? x.name_kz : x.name_ru) : "—");

export const STATUSES = ["new", "routed", "accepted", "in_progress", "awaiting_confirmation", "resolved", "rejected", "reopened"] as const;
export type Status = (typeof STATUSES)[number];
export const OPEN_STATUSES: Status[] = ["new", "routed", "accepted", "in_progress", "awaiting_confirmation", "reopened"];

// Цвет точки на карте: просрочено важнее статуса
export function pointColor(status: string, breached: boolean): string {
  if (status === "resolved") return "#3f9a6b";
  if (status === "rejected") return "#8a94a3";
  if (breached) return "#d0452f";
  if (status === "awaiting_confirmation") return "#d69a1b";
  if (status === "reopened") return "#b4447a";
  return "#2f6fa3";
}

export const STATUS_BADGE: Record<string, string> = {
  new: "bg-secondary text-secondary-foreground",
  routed: "bg-secondary text-secondary-foreground",
  accepted: "bg-primary/10 text-primary",
  in_progress: "bg-primary/15 text-primary",
  awaiting_confirmation: "bg-warn/15 text-[color:var(--warn)]",
  resolved: "bg-ok/15 text-[color:var(--ok)]",
  rejected: "bg-muted text-muted-foreground",
  reopened: "bg-danger/15 text-[color:var(--danger)]",
};

export const AMENITY: Record<string, { ru: string; kz: string }> = {
  school: { ru: "школа", kz: "мектеп" },
  kindergarten: { ru: "детский сад", kz: "балабақша" },
  hospital: { ru: "больница", kz: "аурухана" },
  clinic: { ru: "поликлиника", kz: "емхана" },
};

/** Адрес из OSM-ярлыка «3А мкр, дом 111» → «3А шағын аудан, 111 үй» для казахского интерфейса */
export function addressLabel(label: string | null, lang: Lang): string | null {
  if (!label || lang === "ru") return label;
  return label
    .replace(/(\d+[А-ЯA-Z]?) мкр/g, (_, n: string) => `${n} шағын аудан${/[А-ЯA-Z]$/.test(n) ? "ы" : ""}`)
    .replace(/(?:^|, )дом ([\w/А-Яа-я-]+)/g, (m: string, n: string) => `${m.startsWith(",") ? ", " : ""}${n} үй`)
    .replace(/ мкр\b/g, " шағын ауданы");
}
