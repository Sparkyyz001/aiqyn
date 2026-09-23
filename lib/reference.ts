import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversine, pointInPolygon, type GeoPolygon, type LatLng } from "@/lib/geo";
import { SOCIAL_RADIUS_M } from "@/lib/priority";
import poiSocial from "@/data/poi_social.json";

// Справочники меняются только seed-скриптом, поэтому держим их в памяти процесса.

export type Category = {
  id: number; code: string; name_ru: string; name_kz: string; icon: string | null;
  default_service: number | null; sla_days: number; severity_base: number;
};
export type Service = {
  id: number; code: string; short_name: string; name_ru: string; name_kz: string; description: string | null;
  address: string | null; contact_phone: string | null; contact_email: string | null; verified: boolean; source_url: string | null;
};
export type District = {
  id: number; code: string; name_ru: string; name_kz: string; kind: string;
  center_lat: number; center_lng: number; polygon: GeoPolygon | null; population: number | null;
};
export type Reference = {
  categories: Category[];
  services: Service[];
  districts: District[];
  categoryById: Map<number, Category>;
  categoryByCode: Map<string, Category>;
  serviceById: Map<number, Service>;
  serviceByCode: Map<string, Service>;
  districtById: Map<number, District>;
};

let refPromise: Promise<Reference> | null = null;

async function load(): Promise<Reference> {
  const db = createAdminClient();
  const [c, s, d] = await Promise.all([
    db.from("categories").select("*").order("id"),
    db.from("services").select("*").order("id"),
    db.from("districts").select("*").order("id"),
  ]);
  if (c.error || s.error || d.error) throw new Error("Не удалось загрузить справочники");
  const categories = c.data as Category[];
  const services = s.data as Service[];
  const districts = d.data as District[];
  return {
    categories, services, districts,
    categoryById: new Map(categories.map((x) => [x.id, x])),
    categoryByCode: new Map(categories.map((x) => [x.code, x])),
    serviceById: new Map(services.map((x) => [x.id, x])),
    serviceByCode: new Map(services.map((x) => [x.code, x])),
    districtById: new Map(districts.map((x) => [x.id, x])),
  };
}

export function getReference(): Promise<Reference> {
  refPromise ??= load().catch((e) => {
    refPromise = null;
    throw e;
  });
  return refPromise;
}

/** Микрорайон по точке: сначала по полигону OSM, иначе ближайший центр в радиусе 1.5 км */
export function districtAt(p: LatLng, districts: District[]): District | null {
  const byPoly = districts.find((d) => d.polygon && pointInPolygon(p, d.polygon));
  if (byPoly) return byPoly;
  let best: District | null = null;
  let bestD = 1500;
  for (const d of districts) {
    const dist = haversine(p, { lat: d.center_lat, lng: d.center_lng });
    if (dist < bestD) [best, bestD] = [d, dist];
  }
  return best;
}

type Poi = { amenity: string; name: string | null; lat: number; lng: number };
const SOCIAL = (poiSocial.items as Poi[]).filter((p) =>
  ["school", "kindergarten", "hospital", "clinic"].includes(p.amenity)
);

/** Ближайший социальный объект в радиусе 150 м (слагаемое приоритета) */
export function nearestSocial(p: LatLng): (Poi & { distance_m: number }) | null {
  let best: (Poi & { distance_m: number }) | null = null;
  for (const s of SOCIAL) {
    const d = haversine(p, s);
    if (d <= SOCIAL_RADIUS_M && (!best || d < best.distance_m)) best = { ...s, distance_m: Math.round(d) };
  }
  return best;
}
