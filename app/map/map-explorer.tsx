"use client";

import { useMemo, useState } from "react";
import { CityMap } from "@/components/map/map";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CATEGORIES, CATEGORY, DISTRICTS, nm, OPEN_STATUSES, pointColor } from "@/lib/meta";
import type { MapPoint } from "@/lib/data";
import type { MapChoropleth } from "@/components/map/leaflet-map";
import { PainLegend, PainSwatch } from "@/components/akimat/pain-parts";
import Link from "next/link";
import { fmt } from "@/lib/i18n/dict";
import type { Dict, Lang } from "@/lib/i18n/dict";

type ClusterRow = { category: string; lat: number; lng: number; radius_m: number; count: number; chronic_score: number; label: string | null };
type DistrictInfo = { index: number | null; open: number; breached: number; reports90: number; insufficient: boolean; geojson: GeoJSON.GeoJsonObject | null };
type IncidentRow = { id: number; title: string; polygon: GeoJSON.GeoJsonObject; eta_at: string | null; type: string };

const ALL = "__all";

export function MapExplorer({
  points, clusters, incidents, choropleth, districtInfo, lang, t,
}: {
  points: MapPoint[];
  clusters: ClusterRow[];
  incidents: IncidentRow[];
  choropleth: MapChoropleth[];
  districtInfo: Record<string, DistrictInfo>;
  lang: Lang;
  t: Pick<Dict, "map" | "status" | "nav" | "pain" | "outcome">;
}) {
  const [mode, setMode] = useState<"pins" | "heat" | "pain">("pins");
  const [cat, setCat] = useState(ALL);
  const [district, setDistrict] = useState(ALL);
  const [period, setPeriod] = useState("90");
  const [openOnly, setOpenOnly] = useState(true);
  const [breachedOnly, setBreachedOnly] = useState(false);

  const filtered = useMemo(() => {
    const since = Date.now() - Number(period) * 86400_000;
    return points.filter(
      (p) =>
        (cat === ALL || p.c === cat) &&
        (district === ALL || p.d === district) &&
        new Date(p.at).getTime() >= since &&
        (!openOnly || (OPEN_STATUSES as string[]).includes(p.s)) &&
        (!breachedOnly || p.b)
    );
  }, [points, cat, district, period, openOnly, breachedOnly]);

  const legend = [
    { label: t.map.legendOpen, color: pointColor("in_progress", false) },
    { label: t.map.legendBreached, color: pointColor("in_progress", true) },
    { label: t.map.legendAwaiting, color: pointColor("awaiting_confirmation", false) },
    { label: t.map.legendReopened, color: pointColor("reopened", false) },
    { label: t.map.legendResolved, color: pointColor("resolved", false) },
  ];

  return (
    <div className="relative flex flex-1 flex-col lg:flex-row">
      <aside className="order-2 flex flex-col gap-4 border-t p-4 lg:order-1 lg:w-80 lg:border-t-0 lg:border-r">
        <h1 className="text-lg font-semibold">{t.map.title}</h1>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "pins" | "heat" | "pain")}>
          <TabsList className="w-full">
            <TabsTrigger value="pins" className="flex-1">{t.map.pins}</TabsTrigger>
            <TabsTrigger value="heat" className="flex-1">{t.map.heat}</TabsTrigger>
            <TabsTrigger value="pain" className="flex-1">{t.pain.short}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{t.map.category}</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[1300]">
                <SelectItem value={ALL}>—</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{nm(c, lang)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{t.map.district}</Label>
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[1300] max-h-80">
                <SelectItem value={ALL}>—</SelectItem>
                {DISTRICTS.filter((d) => d.kind !== "zone").map((d) => (
                  <SelectItem key={d.code} value={d.code}>{nm(d, lang)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 grid gap-1.5 lg:col-span-1">
            <Label className="text-xs text-muted-foreground">{t.map.period}</Label>
            <Tabs value={period} onValueChange={setPeriod}>
              <TabsList className="w-full">
                <TabsTrigger value="7" className="flex-1">{t.map.days7}</TabsTrigger>
                <TabsTrigger value="30" className="flex-1">{t.map.days30}</TabsTrigger>
                <TabsTrigger value="90" className="flex-1">{t.map.days90}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {district !== ALL && districtInfo[district] && (
          <div className="rounded-lg border bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{nm(DISTRICTS.find((d) => d.code === district), lang)}</span>
              {districtInfo[district].insufficient ? (
                <span className="text-xs text-muted-foreground">{t.pain.insufficient}</span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs">
                  <PainSwatch index={districtInfo[district].index} />
                  {t.pain.short}: <b className="tabular-nums">{districtInfo[district].index}</b>
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>{fmt(t.pain.openN, { n: districtInfo[district].open })}</span>
              <span className={districtInfo[district].breached ? "text-[color:var(--danger)]" : ""}>{fmt(t.pain.breachedN, { n: districtInfo[district].breached })}</span>
              <span>{t.pain.reports}: {districtInfo[district].reports90}</span>
            </div>
            <Link href={`/district/${district}`} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">{t.outcome.openCard} →</Link>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-2 text-sm">
            {t.map.openOnly}
            <Switch checked={openOnly} onCheckedChange={setOpenOnly} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t.map.breachedOnly}
            <Switch checked={breachedOnly} onCheckedChange={setBreachedOnly} />
          </label>
        </div>

        {mode === "pain" ? (
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <PainLegend t={t.pain} />
            <p>{t.pain.formula}</p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground tabular-nums">
            {t.map.shown}: {filtered.length}
          </div>
        )}

        <ul className="grid grid-cols-2 gap-1.5 text-xs lg:grid-cols-1">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </li>
          ))}
          <li className="col-span-2 flex items-center gap-2 lg:col-span-1">
            <span className="size-3 rounded-full border-2 border-foreground bg-[#2f6fa3]" />
            {t.map.real}
          </li>
        </ul>
      </aside>

      <div className="order-1 h-[60vh] flex-1 lg:order-2 lg:h-auto">
        <CityMap
          fullTouch
          points={mode === "pain" ? [] : filtered}
          mode={mode === "heat" ? "heat" : "pins"}
          choropleth={mode === "pain" ? choropleth : []}
          focus={district !== ALL ? districtInfo[district]?.geojson ?? null : null}
          className="h-full min-h-[60vh] w-full lg:min-h-[calc(100svh-4.5rem)]"
          statusLabels={t.status}
          lang={lang}
          popupLabels={{ created: t.outcome.created, resolved: t.status.resolved, confirmations: t.outcome.confirmations, more: t.outcome.openCard }}
          demoLabel={t.map.demo}
          openLabel={t.map.open}
          circles={mode === "pain" ? [] : clusters
            .filter((c) => cat === ALL || c.category === cat)
            .map((c) => ({
              lat: c.lat, lng: c.lng, radius: Math.max(60, c.radius_m),
              color: c.chronic_score > 0.6 ? "#d0452f" : "#d69a1b",
              label: `${c.label ?? ""} · ${nm(CATEGORY[c.category], lang)} · ${c.count}`,
            }))}
          polygons={incidents.map((i) => ({ geojson: i.polygon, color: "#b4447a", label: i.title }))}
        />
      </div>
    </div>
  );
}
