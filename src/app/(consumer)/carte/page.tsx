import Link from "next/link";
import { ArrowLeft, List, MapPin } from "lucide-react";
import { getMapStores } from "@/lib/data";
import { USER_LOCATION } from "@/lib/geo";
import { MapView } from "@/components/ui/MapView";
import type { MapMarker } from "@/components/ui/LiveMap";

export default async function MapPage() {
  const stores = [...(await getMapStores())].sort(
    (a, b) => a.deliveryMinutes - b.deliveryMinutes
  );
  const totalProducts = stores.reduce((sum, s) => sum + s.products, 0) * 70 + 6;

  const markers: MapMarker[] = [
    { id: "user", lat: USER_LOCATION.lat, lng: USER_LOCATION.lng, variant: "user" },
    ...stores.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      label: `${s.deliveryMinutes} min`,
      variant: "store" as const,
    })),
  ];

  return (
    <div className="relative h-[calc(100dvh-57px)] sm:h-[calc(100dvh-57px)]">
      <MapView className="absolute inset-0" center={[USER_LOCATION.lat, USER_LOCATION.lng]} zoom={14} markers={markers} />

      <div className="absolute inset-x-4 top-4 z-[1000] flex items-center gap-3">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-xl glass border border-border"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="glass flex flex-1 items-center gap-2 rounded-xl border border-border px-4 py-2.5">
          <MapPin className="h-4 w-4 text-brand" />
          <span className="text-sm font-medium">{totalProducts} produits dans votre zone</span>
        </div>
        <Link
          href="/recherche"
          className="flex h-10 w-10 items-center justify-center rounded-xl glass border border-border"
          aria-label="Liste"
        >
          <List className="h-5 w-5" />
        </Link>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[1000]">
        <div className="mx-auto max-w-2xl rounded-t-3xl bg-white px-5 pb-6 pt-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-text">Votre zone connectée</h1>
              <p className="text-sm text-text-secondary">
                {stores.length} commerces · Stock en temps réel
              </p>
            </div>
            <div className="rounded-full bg-success-light px-3 py-1 text-xs font-semibold text-success">
              Dès {stores[0]?.deliveryMinutes ?? 15} min
            </div>
          </div>

          <div className="max-h-48 space-y-2 overflow-y-auto">
            {stores.map((store) => (
              <Link
                key={store.id}
                href="/recherche"
                className="flex items-center justify-between rounded-xl border border-border-light p-3 transition-colors hover:bg-surface-secondary"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-muted text-xs font-bold text-brand">
                    {store.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">{store.name}</p>
                    <p className="text-xs text-text-tertiary">{store.products} produits</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-success">{store.deliveryMinutes} min</p>
                  <p className="text-xs text-text-tertiary">livraison</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
