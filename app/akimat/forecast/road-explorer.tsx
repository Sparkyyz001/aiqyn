"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Wrench } from "lucide-react";
import { CityMap } from "@/components/map/map";
import { StatusBadge } from "@/components/status-badge";
import { fmt, type Dict } from "@/lib/i18n/dict";
import { cn } from "@/lib/utils";

export type RoadSeg = {
  osm_id: string;
  name: string | null;
  highway: string;
  km: number;
  complaints: number;
  risk: number;
  coords: [number, number][];
  parts: { complaints: number; load: number; length: number; frost: number };
  nearby: { no: string; title: string; status: string; statusLabel: string; date: string }[];
};

const riskColor = (r: number) => (r >= 0.85 ? "#b42318" : r >= 0.7 ? "#d0452f" : r >= 0.55 ? "#e08a1e" : "#d6b21b");

// Прогноз дорог: карта рискованных участков + разбор выбранного — какой признак сколько дал
// и какие обращения лежат на этом участке. Клик по линии или по строке списка.
export function RoadExplorer({ segs, ft, t }: { segs: RoadSeg[]; ft: number; t: Dict["akimat"]["forecast"] }) {
  const [sel, setSel] = useState<string>(segs[0]?.osm_id ?? "");
  const s = segs.find((x) => x.osm_id === sel) ?? null;
  const total = s ? s.parts.complaints + s.parts.load + s.parts.length + s.parts.frost : 1;
  const parts = s
    ? [
        { key: "complaints", label: fmt(t.pComplaints, { n: s.complaints }), v: s.parts.complaints, color: "#d0452f" },
        { key: "load", label: fmt(t.pLoad, { cls: s.highway }), v: s.parts.load, color: "#2f6fa3" },
        { key: "length", label: fmt(t.pLength, { km: s.km }), v: s.parts.length, color: "#7c8a99" },
        { key: "frost", label: fmt(t.pFrost, { n: ft }), v: s.parts.frost, color: "#4fa3d9" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-xl border">
          <CityMap
            className="h-[460px] w-full"
            polygons={segs.map((x) => ({
              key: `${x.osm_id}-${x.osm_id === sel}`,
              geojson: { type: "LineString", coordinates: x.coords } as GeoJSON.LineString,
              color: x.osm_id === sel ? "#0b3b40" : riskColor(x.risk),
              weight: x.osm_id === sel ? 8 : 4 + x.risk * 3,
              tooltip: `${x.name ?? t.unnamed} · ${fmt(t.share, { p: Math.round(x.risk * 100) })}`,
              onClick: () => setSel(x.osm_id),
            }))}
          />
        </div>
        <ol className="max-h-[460px] overflow-y-auto rounded-xl border bg-card">
          {segs.map((x, i) => (
            <li key={x.osm_id}>
              <button
                type="button"
                onClick={() => setSel(x.osm_id)}
                className={cn("flex w-full items-center gap-3 border-b px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/50", x.osm_id === sel && "bg-primary/10")}
              >
                <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 font-medium">{x.name ?? t.unnamed}</span>
                  <span className="text-xs text-muted-foreground">{x.highway} · {x.km} km · {t.complaints}: {x.complaints}</span>
                </span>
                <span className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums" style={{ background: riskColor(x.risk) }}>{Math.round(x.risk * 100)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {s ? (
        <section className="grid gap-4 rounded-xl border bg-card p-5 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{s.name ?? t.unnamed}</h2>
                <p className="text-sm text-muted-foreground">{s.highway} · {s.km} km</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold tabular-nums" style={{ color: riskColor(s.risk) }}>{Math.round(s.risk * 100)}</div>
                <div className="text-xs text-muted-foreground">{t.risk}</div>
              </div>
            </div>
            <h3 className="mt-4 text-sm font-semibold">{t.why}</h3>
            <ul className="mt-2 flex flex-col gap-2.5">
              {parts.map((p) => (
                <li key={p.key}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{p.label}</span>
                    <span className="text-muted-foreground tabular-nums">{Math.round((p.v / total) * 100)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(p.v / total) * 100}%`, background: p.color }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
              <Wrench className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <div className="text-xs font-semibold text-primary">{t.advice}</div>
                {s.risk >= 0.8 && s.complaints > 0 ? t.adviceHigh : s.risk >= 0.6 ? t.adviceMid : t.adviceLow}
              </div>
            </div>
            <a href={`https://www.openstreetmap.org/${s.osm_id}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink className="size-3" /> {t.open}
            </a>
          </div>
          <div>
            <h3 className="text-sm font-semibold">{t.nearby}</h3>
            {s.nearby.length ? (
              <ul className="mt-2 divide-y rounded-lg border">
                {s.nearby.map((r) => (
                  <li key={r.no}>
                    <Link href={`/report/${r.no}`} className="flex items-start justify-between gap-2 px-3 py-2 text-sm hover:bg-accent/50">
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-medium">{r.title}</span>
                        <span className="text-xs text-muted-foreground">{r.no} · {r.date}</span>
                      </span>
                      <StatusBadge status={r.status} label={r.statusLabel} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t.noNearby}</p>
            )}
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">{t.pick}</p>
      )}
    </div>
  );
}
