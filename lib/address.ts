import "server-only";
import { haversine, type LatLng } from "@/lib/geo";
import slim from "@/data/addresses.slim.json";

// Ближайший адрес из OSM (18 тыс. точек) — для ярлыков узлов «3 мкр, дом 111»
// и подсказки адреса при подаче. Сетка ~500 м, чтобы не перебирать всё.

type Row = [number, number, string];
const CELL = 0.005;
const key = (lat: number, lng: number) => `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`;
const grid = new Map<string, Row[]>();
for (const r of slim.items as Row[]) {
  const k = key(r[0], r[1]);
  (grid.get(k) ?? grid.set(k, []).get(k)!).push(r);
}

export function nearestAddress(p: LatLng, maxM = 150): { label: string; distance_m: number } | null {
  const ci = Math.floor(p.lat / CELL), cj = Math.floor(p.lng / CELL);
  let best: { label: string; distance_m: number } | null = null;
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++)
      for (const [lat, lng, label] of grid.get(`${ci + di}:${cj + dj}`) ?? []) {
        const d = haversine(p, { lat, lng });
        if (d <= maxM && (!best || d < best.distance_m)) best = { label, distance_m: Math.round(d) };
      }
  return best;
}
