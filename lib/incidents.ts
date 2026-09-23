// Тип аварии → категории обращений, которые к ней привязываются (ФИШКА 5)
export const INCIDENT_CATEGORIES: Record<string, string[]> = {
  water: ["water_outage"],
  power: ["power_outage", "lighting"],
  heat: ["heating"],
  road_closure: ["road_pit", "excavation"],
};

export const INCIDENT_TYPES = [
  { code: "water", ru: "Нет воды", kz: "Су жоқ", service: "kzhsa" },
  { code: "power", ru: "Нет электричества", kz: "Электр қуаты жоқ", service: "aues" },
  { code: "heat", ru: "Нет отопления", kz: "Жылу жоқ", service: "kzhsa" },
  { code: "road_closure", ru: "Перекрытие дороги", kz: "Жол жабылды", service: "roads" },
] as const;

export const incidentTypeFor = (categoryCode: string) =>
  Object.entries(INCIDENT_CATEGORIES).find(([, cats]) => cats.includes(categoryCode))?.[0] ?? null;
