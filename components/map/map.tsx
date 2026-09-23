"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeafletMapProps } from "./leaflet-map";

// Leaflet работает только в браузере — грузим без SSR.
// 2GIS MapGL подключается сюда же, когда появится ключ (NEXT_PUBLIC_2GIS_API_KEY);
// Leaflet остаётся фолбэком на случай отказа 2GIS или отсутствия WebGL.
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export function CityMap(props: LeafletMapProps) {
  return <LeafletMap {...props} />;
}
