"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  variant?: "store" | "store-muted" | "user" | "driver";
  badge?: number;
}

interface LiveMapProps {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  route?: [number, number][];
  className?: string;
}

function storeIcon(label: string, muted: boolean, badge?: number) {
  const bg = muted ? "#6b7280" : "#0f2d5c";
  const badgeHtml =
    badge && badge > 0
      ? `<span style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:9999px;background:#059669;color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center">${badge}</span>`
      : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;transform:translate(-50%,-100%);white-space:nowrap">
      <div style="position:relative;background:${bg};color:#fff;font-size:10px;font-weight:700;padding:3px 9px;border-radius:9999px;box-shadow:0 1px 5px rgba(0,0,0,.28)">${badgeHtml}${label}</div>
      <div style="width:8px;height:8px;background:${bg};transform:rotate(45deg);margin:-2px auto 0"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="transform:translate(-50%,-50%)">
      <div style="position:absolute;inset:-12px;border-radius:9999px;background:${color}1f"></div>
      <div style="position:relative;width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.3)"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function LiveMap({
  center,
  zoom = 14,
  markers = [],
  route,
  className,
}: LiveMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      attributionControl={false}
      className={className}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={20}
      />
      <Recenter center={center} zoom={zoom} />

      {route && route.length > 1 && (
        <Polyline
          positions={route}
          pathOptions={{ color: "#0f2d5c", weight: 4, opacity: 0.7, dashArray: "8 8" }}
        />
      )}

      {markers.map((m) => {
        let icon: L.DivIcon;
        if (m.variant === "user") icon = dotIcon("#0f2d5c");
        else if (m.variant === "driver") icon = dotIcon("#0f2d5c");
        else icon = storeIcon(m.label ?? "", m.variant === "store-muted", m.badge);
        return <Marker key={m.id} position={[m.lat, m.lng]} icon={icon} />;
      })}
    </MapContainer>
  );
}
