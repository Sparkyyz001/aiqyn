import { Siren } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReference } from "@/lib/reference";
import { pointInPolygon, type GeoPolygon } from "@/lib/geo";
import { fmt as tf, type Dict } from "@/lib/i18n/dict";
import { CityMap } from "@/components/map/map";
import { LiveRefresh } from "@/components/live-refresh";
import slim from "@/data/addresses.slim.json";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.incidents };
}

// Сколько домов затронуто: адресные точки OSM внутри зоны аварии (население районов в OSM не указано)
function buildingsInside(poly: GeoPolygon) {
  let n = 0;
  for (const [lat, lng] of slim.items as [number, number, string][]) if (pointInPolygon({ lat, lng }, poly)) n++;
  return n;
}

export default async function IncidentsPage() {
  const [{ t }, ref] = await Promise.all([getDict(), getReference()]);
  const db = createAdminClient();
  const { data: incidents } = await db
    .from("incidents")
    .select("id, type, title, description, polygon, started_at, eta_at, resolved_at, status, service_id")
    .order("started_at", { ascending: false })
    .limit(30);
  const active = (incidents ?? []).filter((i) => i.status === "active");
  const past = (incidents ?? []).filter((i) => i.status !== "active");
  const counts = await Promise.all(
    active.map(async (i) => (await db.from("reports").select("id", { count: "exact", head: true }).eq("incident_id", i.id)).count ?? 0)
  );
  const fmt = (s: string) => new Date(s).toLocaleString("ru-RU", { timeZone: "Asia/Aqtau", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <LiveRefresh table="incidents" />
      <h1 className="text-xl font-semibold">{t.nav.incidents}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.incident.pageIntro}
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-lg border">
          <CityMap
            className="h-[420px] w-full"
            polygons={active.map((i) => ({ geojson: i.polygon, color: "#b4447a", label: i.title }))}
          />
        </div>
        <div className="flex flex-col gap-3">
          {active.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t.incident.noActive}</div>}
          {active.map((i, idx) => {
            const overdue = i.eta_at && new Date(i.eta_at) < new Date();
            return (
              <div key={i.id} className="rounded-lg border border-[#b4447a]/40 p-4">
                <div className="flex items-start gap-2">
                  <Siren className="mt-0.5 size-4 shrink-0 text-[#b4447a]" />
                  <div className="min-w-0">
                    <div className="font-medium">{i.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.incident.types[i.type as keyof Dict["incident"]["types"]]} · {i.service_id ? ref.serviceById.get(i.service_id)?.short_name : ""}
                    </div>
                  </div>
                </div>
                {i.description && <p className="mt-2 text-sm">{i.description}</p>}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.incident.from}</dt>
                    <dd className="tabular-nums">{fmt(i.started_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.card.restoreBy}</dt>
                    <dd className={`tabular-nums ${overdue ? "font-semibold text-[color:var(--danger)]" : ""}`}>{i.eta_at ? fmt(i.eta_at) : t.incident.notSet}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.incident.houses}</dt>
                    <dd className="tabular-nums">{buildingsInside(i.polygon)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t.incident.linked}</dt>
                    <dd className="tabular-nums">{counts[idx]}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
          {past.length > 0 && (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer">{tf(t.incident.past, { n: past.length })}</summary>
              <ul className="mt-2 space-y-1">
                {past.map((i) => (
                  <li key={i.id} className="text-muted-foreground">
                    {i.title} · {fmt(i.started_at)} → {i.resolved_at ? fmt(i.resolved_at) : "—"}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
