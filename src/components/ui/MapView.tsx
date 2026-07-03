"use client";

import dynamic from "next/dynamic";
import { clsx } from "clsx";
import type { MapMarker } from "./LiveMap";

const LiveMap = dynamic(() => import("./LiveMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-tertiary" />,
});

interface MapViewProps {
  className?: string;
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  route?: [number, number][];
}

export function MapView({ className, center, zoom, markers, route }: MapViewProps) {
  return (
    <div className={clsx("relative overflow-hidden", className)}>
      <LiveMap center={center} zoom={zoom} markers={markers} route={route} />
    </div>
  );
}
