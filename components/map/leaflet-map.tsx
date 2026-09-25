"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Bus, CircleHelp, Construction, Droplets, Flame, Lightbulb, Shovel, Trash2, Trees, Umbrella, Waves, Wind, Zap } from "lucide-react";
import L from "leaflet";
import "leaflet.heat";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, Tooltip, useMap, Circle, Marker, useMapEvents } from "react-leaflet";
import { useTheme } from "next-themes";
import { AKTAU_CENTER } from "@/lib/geo";
import { CATEGORY, DISTRICT, SERVICE, nm, pointColor } from "@/lib/meta";
import type { Lang } from "@/lib/i18n/dict";
import { painColor } from "@/lib/pain-index";
import type { MapPoint } from "@/lib/data";

export type MapOverlayCircle = { lat: number; lng: number; radius: number; color: string; label?: string; href?: string };
export type MapOverlayPolygon = { geojson: GeoJSON.GeoJsonObject; color: string; label?: string; fill?: string; fillOpacity?: number; weight?: number; tooltip?: string; key?: string; onClick?: () => void; opacity?: number };
// Заливка районов по индексу 0–100 (цвет по проверенной шкале, своей для светлой и тёмной темы)
export type MapChoropleth = { geojson: GeoJSON.GeoJsonObject; index: number | null; label: string; href?: string };

export type LeafletMapProps = {
  points?: MapPoint[];
  mode?: "pins" | "heat";
  circles?: MapOverlayCircle[];
  polygons?: MapOverlayPolygon[];
  choropleth?: MapChoropleth[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  statusLabels?: Record<string, string>;
  lang?: Lang;
  popupLabels?: { created: string; resolved: string; confirmations: string; more: string };
  demoLabel?: string;
  openLabel?: string;
  // режим выбора точки
  picked?: { lat: number; lng: number } | null;
  onPick?: (p: { lat: number; lng: number }) => void;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  // Полноэкранная карта и выбор точки: карта двигается одним пальцем.
  // Встроенные в страницу карты на телефоне: одним пальцем прокручивается страница,
  // карта — двумя пальцами (иначе страницу невозможно пролистать).
  fullTouch?: boolean;
  // Выделить район: подсветить границу и вписать карту в его пределы
  focus?: GeoJSON.GeoJsonObject | null;
};

// Значки категорий для реальных обращений: булавка цвета статуса с иконкой проблемы
const CAT_ICON: Record<string, typeof Bus> = {
  road_pit: Construction, excavation: Shovel, water_outage: Droplets, sewage: Waves, heating: Flame, power_outage: Zap,
  lighting: Lightbulb, garbage: Trash2, smell: Wind, yard: Trees, transport: Bus, beach: Umbrella, other: CircleHelp,
};
const iconCache = new Map<string, L.DivIcon>();
function pinIcon(cat: string, color: string, fresh: boolean) {
  const key = `${cat}|${color}|${fresh}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const Svg = CAT_ICON[cat] ?? CircleHelp;
    const glyph = renderToStaticMarkup(<Svg size={15} strokeWidth={2.4} color="#fff" />);
    icon = L.divIcon({
      className: "",
      html: `<div class="aq-pin${fresh ? " aq-pin-fresh" : ""}" style="--c:${color}"><span class="aq-pin-body">${glyph}</span></div>`,
      iconSize: [34, 42],
      iconAnchor: [17, 40],
      popupAnchor: [0, -36],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

// Иконка маркера выбора точки — без внешних картинок (у Leaflet по умолчанию битые пути в бандле)
const pickIcon = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#2f6fa3;border:2px solid white;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

function HeatLayer({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.heatLayer(
      points.map((p) => [p.lat, p.lng, p.b ? 1 : 0.6] as [number, number, number]),
      { radius: 22, blur: 18, maxZoom: 16, minOpacity: 0.3 }
    );
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, points]);
  return null;
}

function FitTo({ shape }: { shape: GeoJSON.GeoJsonObject | null }) {
  const map = useMap();
  useEffect(() => {
    if (!shape) return;
    const b = L.geoJSON(shape).getBounds();
    if (b.isValid()) map.flyToBounds(b, { padding: [24, 24], maxZoom: 16, duration: 0.6 });
  }, [map, shape]);
  return null;
}

function PickHandler({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FlyTo({ to }: { to: { lat: number; lng: number; zoom?: number } | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.flyTo([to.lat, to.lng], to.zoom ?? Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, to]);
  return null;
}

function PointPopup({ p, statusLabels, lang, popupLabels, openLabel }: { p: MapPoint; statusLabels: Record<string, string>; lang: Lang; popupLabels?: LeafletMapProps["popupLabels"]; openLabel: string }) {
  const color = pointColor(p.s, p.b);
  const d = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Asia/Aqtau" });
  return (
    <Popup minWidth={240} maxWidth={290} className="aq-popup">
      <div className="aq-popup-strip" style={{ background: color }} />
      <div className="space-y-2 px-3.5 pt-3 pb-3.5 text-[13px] leading-snug">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: color }}>{statusLabels[p.s] ?? p.s}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{p.no}</span>
        </div>
        <div className="text-[14px] font-semibold">{p.t}</div>
        <div className="text-xs text-muted-foreground">
          {nm(CATEGORY[p.c], lang)}
          {p.d ? ` · ${nm(DISTRICT[p.d], lang)}` : ""}
          {SERVICE[p.sv] ? ` · ${SERVICE[p.sv].short}` : ""}
        </div>
        {popupLabels && p.at && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{popupLabels.created}: <b className="font-medium text-foreground">{d(p.at)}</b></span>
            {p.res && <span>{popupLabels.resolved}: <b className="font-medium text-foreground">{d(p.res)}</b></span>}
            {p.cf > 0 && <span>{popupLabels.confirmations}: <b className="font-medium text-foreground">{p.cf}</b></span>}
          </div>
        )}
        {p.no && (
          <a href={`/report/${p.no}`} className="aq-popup-btn">
            {popupLabels?.more ?? openLabel} →
          </a>
        )}
      </div>
    </Popup>
  );
}

export default function LeafletMap({
  points = [], mode = "pins", circles = [], polygons = [], choropleth = [], center = AKTAU_CENTER, zoom = 13, className,
  statusLabels = {}, lang = "ru", popupLabels, openLabel = "Открыть", picked, onPick, flyTo, fullTouch = false, focus = null,
}: LeafletMapProps) {
  const touchLock = !fullTouch && L.Browser.mobile;
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  // Модельные — лёгкие точки на canvas, реальные — булавки с иконкой категории поверх
  const modelled = useMemo(() => points.filter((p) => p.demo), [points]);
  const real = useMemo(() => points.filter((p) => !p.demo), [points]);
  // «свежие» (последние 7 дней) пульсируют; время берём один раз на рендер карты
  const week = useMemo(() => new Date().getTime() - 7 * 86_400_000, []);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className={className}
      scrollWheelZoom={fullTouch}
      dragging={!touchLock}
      preferCanvas
      style={touchLock ? { touchAction: "pan-y" } : undefined}
    >
      {/* Тайлы OpenStreetMap (без ключа, с атрибуцией). Тёмная тема — CSS-инверсия только подложки */}
      <TileLayer
        key={dark ? "dark" : "light"}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        className={dark ? "aiqyn-dark-tiles" : "aiqyn-soft-tiles"}
      />
      {choropleth.map((c, i) => (
        <GeoJSON
          key={`${i}-${dark}-${c.index}`}
          data={c.geojson}
          style={{ color: dark ? "#0b0e12" : "#ffffff", weight: 1, fillColor: painColor(c.index, dark), fillOpacity: c.index == null ? 0.25 : 0.7 }}
        >
          <Popup>
            {c.href ? (
              <a href={c.href} className="text-primary underline">
                {c.label}
              </a>
            ) : (
              c.label
            )}
          </Popup>
        </GeoJSON>
      ))}
      {polygons.map((p, i) => (
        <GeoJSON
          key={p.key ?? i}
          data={p.geojson}
          style={{ color: p.color, weight: p.weight ?? 1.5, opacity: p.opacity ?? 1, fillColor: p.fill ?? p.color, fillOpacity: p.fillOpacity ?? 0.15, lineCap: "round", lineJoin: "round" }}
          eventHandlers={p.onClick ? { click: p.onClick } : undefined}
        >
          {p.tooltip && (
            <Tooltip sticky direction="top" opacity={0.95}>
              <span className="whitespace-pre-line">{p.tooltip}</span>
            </Tooltip>
          )}
          {p.label && <Popup>{p.label}</Popup>}
        </GeoJSON>
      ))}
      {mode === "heat" ? (
        <HeatLayer points={points} />
      ) : (
        <>
          {modelled.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={4.5}
              pathOptions={{ color: "#ffffff", weight: 1, opacity: dark ? 0.35 : 0.9, fillColor: pointColor(p.s, p.b), fillOpacity: 0.85 }}
              eventHandlers={{
                mouseover: (e) => e.target.setRadius(8),
                mouseout: (e) => e.target.setRadius(4.5),
              }}
            >
              <PointPopup p={p} statusLabels={statusLabels} lang={lang} popupLabels={popupLabels} openLabel={openLabel} />
            </CircleMarker>
          ))}
          {real.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.c, pointColor(p.s, p.b), !!p.at && new Date(p.at).getTime() > week)} zIndexOffset={1000}>
              <PointPopup p={p} statusLabels={statusLabels} lang={lang} popupLabels={popupLabels} openLabel={openLabel} />
            </Marker>
          ))}
        </>
      )}
      {circles.map((c, i) => (
        <Circle key={i} center={[c.lat, c.lng]} radius={c.radius} pathOptions={{ color: c.color, fillColor: c.color, fillOpacity: 0.25, weight: 1.5 }}>
          {c.label && (
            <Popup>
              {c.href ? (
                <a href={c.href} className="text-primary underline">
                  {c.label}
                </a>
              ) : (
                c.label
              )}
            </Popup>
          )}
        </Circle>
      ))}
      {onPick && <PickHandler onPick={onPick} />}
      {picked && <Marker position={[picked.lat, picked.lng]} icon={pickIcon} />}
      <FlyTo to={flyTo} />
      <FitTo shape={focus} />
      {focus && (
        <GeoJSON
          key={JSON.stringify(focus).length + (dark ? "d" : "l")}
          data={focus}
          style={{ color: dark ? "#8ec3ff" : "#1b4f7a", weight: 3, fillOpacity: 0.06, dashArray: "6 4" }}
          interactive={false}
        />
      )}
    </MapContainer>
  );
}
