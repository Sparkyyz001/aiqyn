// Геометрия: расстояние по гаверсинусу, точка в полигоне, привязка к микрорайону.
// Координаты GeoJSON — [lng, lat].

export type LatLng = { lat: number; lng: number };
type Ring = [number, number][];
export type GeoPolygon =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

export const AKTAU_CENTER: LatLng = { lat: 43.6505, lng: 51.1605 };
export const AKTAU_BBOX = { s: 43.55, w: 51.1, n: 43.72, e: 51.3 };

export const inAktau = (p: LatLng) =>
  p.lat >= AKTAU_BBOX.s && p.lat <= AKTAU_BBOX.n && p.lng >= AKTAU_BBOX.w && p.lng <= AKTAU_BBOX.e;

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Расстояние между точками по поверхности Земли, метры */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Грубый bbox вокруг точки на radius метров — для предфильтра в SQL перед точным гаверсинусом */
export function bboxAround(p: LatLng, radiusM: number) {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos(rad(p.lat)));
  return { minLat: p.lat - dLat, maxLat: p.lat + dLat, minLng: p.lng - dLng, maxLng: p.lng + dLng };
}

/** Ray casting: чётность пересечений луча с рёбрами кольца */
function inRing(p: LatLng, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(p: LatLng, poly: GeoPolygon): boolean {
  const polys = poly.type === "Polygon" ? [poly.coordinates] : poly.coordinates;
  // Внешнее кольцо содержит точку, и ни одна «дырка» — нет
  return polys.some((rings) => inRing(p, rings[0]) && !rings.slice(1).some((h) => inRing(p, h)));
}

/** Направление (азимут) от a к b в градусах, 0 = север, по часовой */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Точка на расстоянии distM по азимуту brg от p */
export function destination(p: LatLng, brg: number, distM: number): LatLng {
  const δ = distM / R, θ = rad(brg), φ1 = rad(p.lat), λ1 = rad(p.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI };
}
