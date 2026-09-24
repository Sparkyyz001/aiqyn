"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Footprints, Map as MapIcon, MessageSquareText, Wrench } from "lucide-react";
import { toast } from "sonner";
import { CityMap } from "@/components/map/map";
import { StatusBadge } from "@/components/status-badge";
import { roadFeedback } from "@/lib/actions/roads";
import { fmt, type Dict } from "@/lib/i18n/dict";
import { cn } from "@/lib/utils";

type Votes = { potholes: number; cracks: number; ok: number; repaired: number };
export type RoadSeg = {
  osm_id: string;
  name: string | null;
  highway: string;
  km: number;
  complaints: number;
  risk: number;
  coords: [number, number][];
  parts: { complaints: number; load: number; length: number; frost: number; feedback: number };
  nearby: { no: string; title: string; status: string; statusLabel: string; date: string }[];
  votes: Votes;
  mine: keyof Votes | null;
};

// цвета как у слоя пробок: тёмно-красный — критично, красный, оранжевый, жёлтый
const riskColor = (r: number) => (r >= 0.85 ? "#a50e0e" : r >= 0.7 ? "#e53935" : r >= 0.55 ? "#f57c00" : "#f9a825");
const VERDICTS = ["potholes", "cracks", "ok", "repaired"] as const;
const mid = (c: [number, number][]) => {
  const p = c[Math.floor(c.length / 2)];
  return { lat: p[1], lng: p[0] };
};

// Прогноз дорог как в картографических сервисах: тонкие линии риска, по клику — приближение
// к участку и карточка «почему он здесь», ссылки на уличные панорамы и отзыв о состоянии с места.
export function RoadExplorer({ segs, ft, loggedIn, t }: { segs: RoadSeg[]; ft: number; loggedIn: boolean; t: Dict["akimat"]["forecast"] }) {
  const [sel, setSel] = useState<string | null>(null);
  const [fly, setFly] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [fb, setFb] = useState<Record<string, { votes: Votes; mine: keyof Votes | null }>>({});
  const [pending, start] = useTransition();
  const s = segs.find((x) => x.osm_id === sel) ?? null;
  const cur = s ? fb[s.osm_id] ?? { votes: s.votes, mine: s.mine } : null;

  const choose = (id: string) => {
    const x = segs.find((y) => y.osm_id === id);
    if (!x) return;
    setSel(id);
    setFly({ ...mid(x.coords), zoom: 16 });
  };

  const vote = (v: keyof Votes) =>
    s &&
    start(async () => {
      const r = await roadFeedback(s.osm_id, v);
      if (!r.ok) return void toast.error(r.error);
      setFb((p) => ({ ...p, [s.osm_id]: { votes: r.data as Votes, mine: v } }));
      toast.success(t.fbThanks);
    });

  const total = s ? Object.values(s.parts).reduce((a, b) => a + b, 0) || 1 : 1;
  const parts = s
    ? [
        { key: "complaints", label: fmt(t.pComplaints, { n: s.complaints }), v: s.parts.complaints, color: "#d0452f" },
        { key: "feedback", label: fmt(t.pFeedback, { n: s.votes.potholes + s.votes.cracks }), v: s.parts.feedback, color: "#8a63d2" },
        { key: "load", label: fmt(t.pLoad, { cls: s.highway }), v: s.parts.load, color: "#2f6fa3" },
        { key: "frost", label: fmt(t.pFrost, { n: ft }), v: s.parts.frost, color: "#4fa3d9" },
        { key: "length", label: fmt(t.pLength, { km: s.km }), v: s.parts.length, color: "#7c8a99" },
      ].filter((p) => p.v > 0)
    : [];
  const at = s ? mid(s.coords) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-xl border">
          <CityMap
            className="h-[520px] w-full"
            flyTo={fly}
            polygons={segs.flatMap((x) => {
              // как слой пробок в картографических сервисах: светлая «обочина» + цветная полоса по самой улице
              const on = x.osm_id === sel;
              const geojson = { type: "LineString", coordinates: x.coords } as GeoJSON.LineString;
              const tooltip = `${x.name ?? t.unnamed} · ${fmt(t.share, { p: Math.round(x.risk * 100) })}`;
              return [
                { key: `${x.osm_id}-c-${on}`, geojson, color: on ? "#0b3b40" : "#ffffff", weight: on ? 10 : 6.5, opacity: on ? 0.95 : 0.9, tooltip, onClick: () => choose(x.osm_id) },
                { key: `${x.osm_id}-l-${on}`, geojson, color: riskColor(x.risk), weight: on ? 5 : 3.5, opacity: 0.95, tooltip, onClick: () => choose(x.osm_id) },
              ];
            })}
          />
        </div>
        <ol className="max-h-[520px] overflow-y-auto rounded-xl border bg-card">
          {segs.map((x, i) => (
            <li key={x.osm_id}>
              <button
                type="button"
                onClick={() => choose(x.osm_id)}
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

      {s && at && cur ? (
        <section className="grid gap-5 rounded-xl border bg-card p-5 lg:grid-cols-[1.1fr_1fr]">
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
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-semibold">{t.onSite}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${at.lat},${at.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent">
                  <Footprints className="size-4" /> {t.streetView}
                </a>
                <a href={`https://www.google.com/maps/search/?api=1&query=${at.lat},${at.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent">
                  <MapIcon className="size-4" /> {t.gmaps}
                </a>
                <a href={`https://2gis.kz/aktau/geo/${at.lng},${at.lat}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent">
                  <ExternalLink className="size-4" /> {t.twogis}
                </a>
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquareText className="size-4 text-primary" /> {t.fbTitle}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{loggedIn ? t.fbHint : t.fbLogin}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {VERDICTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={!loggedIn || pending}
                    onClick={() => vote(v)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-[transform,background-color,border-color] duration-200 enabled:hover:-translate-y-0.5 enabled:hover:border-primary/40 disabled:opacity-60",
                      cur.mine === v && "border-primary bg-primary/10"
                    )}
                  >
                    <span>
                      {t.fb[v]}
                      {cur.mine === v && <span className="block text-[11px] text-primary">{t.fbYours}</span>}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">{cur.votes[v]}</span>
                  </button>
                ))}
              </div>
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
            <a href={`https://www.openstreetmap.org/${s.osm_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink className="size-3" /> {t.open}
            </a>
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t.pick}</p>
      )}
    </div>
  );
}
