import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { flow } from "@/lib/data";
import { haversine } from "@/lib/geo";
import { DISTRICT, nm } from "@/lib/meta";
import { CityMap } from "@/components/map/map";
import stops from "@/data/transit_stops.json";
import poi from "@/data/poi_social.json";

export const metadata = { title: "Тёмные зоны" };

// Модуль 8.3: тёмные зоны. Реестра фонарей в OSM по Актау нет (0 точек highway=street_lamp),
// поэтому зоны строятся по обращениям категории «Не горит уличный свет».
// risk = 0.4·min(1, дней без света / 30) + 0.35·[школа/садик ≤200 м] + 0.25·[остановка ≤100 м]
type P = { lat: number; lng: number; amenity?: string };
const SCHOOLS = (poi.items as P[]).filter((p) => p.amenity === "school" || p.amenity === "kindergarten");
const STOPS = stops.items as P[];
const near = (p: P, list: P[], m: number) => list.some((x) => haversine(p, x) <= m);

export default async function LightPage() {
  const [{ lang }, { all }] = await Promise.all([getDict(), flow()]);
  const dark = all
    .filter((r) => r.category === "lighting" && !["resolved", "rejected"].includes(r.status))
    .map((r) => {
      const days = (Date.now() - new Date(r.created_at).getTime()) / 86400_000;
      const school = near(r, SCHOOLS, 200);
      const stop = near(r, STOPS, 100);
      const risk = 0.4 * Math.min(1, days / 30) + 0.35 * Number(school) + 0.25 * Number(stop);
      return { ...r, days: Math.round(days), school, stop, risk: Math.round(risk * 100) / 100 };
    })
    .sort((a, b) => b.risk - a.risk);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Тёмные зоны</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          В OpenStreetMap по Актау нет реестра фонарей, поэтому тёмные зоны строятся по жалобам жителей. Приоритет ремонта:
          сколько дней темно, рядом ли школа или детский сад (200 м) и остановка (100 м) — там ходят дети и ждут автобус вечером.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <CityMap
          className="h-[400px] w-full"
          circles={dark.map((d) => ({ lat: d.lat, lng: d.lng, radius: 60 + d.risk * 90, color: d.risk >= 0.6 ? "#d0452f" : "#d69a1b", label: `${d.title} · ${d.days} дн.` }))}
        />
      </div>
      <section className="rounded-lg border">
        <h2 className="border-b px-4 py-2.5 font-medium">Приоритетный список ремонта освещения ({dark.length})</h2>
        <ul className="divide-y text-sm">
          {dark.slice(0, 20).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
              <span className="w-10 font-semibold tabular-nums">{d.risk.toFixed(2)}</span>
              {d.demo ? <span className="min-w-0 flex-1">{d.title}</span> : <Link className="min-w-0 flex-1 text-primary hover:underline" href={`/report/${d.public_no}`}>{d.title}</Link>}
              <span className="text-xs text-muted-foreground">
                {nm(DISTRICT[d.district ?? ""], lang)} · {d.days} дн.{d.school ? " · рядом школа/садик" : ""}{d.stop ? " · остановка" : ""}{d.demo ? " · демо" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
