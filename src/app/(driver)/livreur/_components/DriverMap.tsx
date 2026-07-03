"use client";

import dynamic from "next/dynamic";
import type { MapMarker } from "@/components/ui/LiveMap";
import type { DriverMission } from "@/lib/types";

const LiveMap = dynamic(() => import("@/components/ui/LiveMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-tertiary" />,
});

/** Position simulée du livreur (centre de la zone pilote). */
export const DRIVER_LOCATION = { lat: 48.8552, lng: 2.349 };

interface DriverMapProps {
  isOnline: boolean;
  missions: DriverMission[];
}

export function DriverMap({ isOnline, missions }: DriverMapProps) {
  const markers: MapMarker[] = [
    { id: "driver", lat: DRIVER_LOCATION.lat, lng: DRIVER_LOCATION.lng, variant: "driver" },
    ...missions.map((m, i) => ({
      id: m.id,
      lat: m.storeLat,
      lng: m.storeLng,
      label: `${m.deliveryMinutes} min`,
      variant: isOnline ? ("store" as const) : ("store-muted" as const),
      badge: isOnline && i === 0 ? 1 : undefined,
    })),
  ];

  const route =
    isOnline && missions[0]
      ? ([
          [DRIVER_LOCATION.lat, DRIVER_LOCATION.lng],
          [missions[0].storeLat, missions[0].storeLng],
        ] as [number, number][])
      : undefined;

  return (
    <div className="relative h-full w-full">
      <LiveMap
        center={[DRIVER_LOCATION.lat, DRIVER_LOCATION.lng]}
        zoom={14}
        markers={markers}
        route={route}
      />
      {!isOnline && (
        <div className="pointer-events-none absolute inset-0 z-[500] bg-white/40" />
      )}
    </div>
  );
}
