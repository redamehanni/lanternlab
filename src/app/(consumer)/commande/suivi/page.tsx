import { notFound } from "next/navigation";
import { Check, Clock, Phone, MessageCircle } from "lucide-react";
import { clsx } from "clsx";
import { getOrder } from "@/lib/data";
import { USER_LOCATION } from "@/lib/geo";
import { MapView } from "@/components/ui/MapView";
import type { OrderStatus } from "@/lib/types";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Commande confirmée" },
  { status: "preparing", label: "Préparation" },
  { status: "assigned", label: "Livreur en route vers le commerce" },
  { status: "picked_up", label: "Produit récupéré" },
  { status: "delivering", label: "Livraison en cours" },
  { status: "delivered", label: "Arrivée estimée" },
];

const ORDER_RANK: Record<OrderStatus, number> = {
  pending: 0,
  preparing: 1,
  ready: 1,
  assigned: 2,
  picked_up: 3,
  delivering: 4,
  delivered: 5,
  cancelled: 0,
};

export default async function DeliveryTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) notFound();
  const order = await getOrder(orderId);
  if (!order) notFound();

  const currentRank = ORDER_RANK[order.status];
  const arrival = new Date(Date.now() + order.etaMinutes * 60000).toLocaleTimeString(
    "fr-FR",
    { hour: "2-digit", minute: "2-digit" }
  );

  return (
    <div className="mx-auto max-w-lg">
      <div className="relative h-64">
        <MapView
          className="h-full"
          center={[
            (order.storeLat + USER_LOCATION.lat) / 2,
            (order.storeLng + USER_LOCATION.lng) / 2,
          ]}
          zoom={14}
          markers={[
            { id: "store", lat: order.storeLat, lng: order.storeLng, label: order.storeName, variant: "store" },
            { id: "user", lat: USER_LOCATION.lat, lng: USER_LOCATION.lng, variant: "user" },
          ]}
          route={[
            [order.storeLat, order.storeLng],
            [USER_LOCATION.lat, USER_LOCATION.lng],
          ]}
        />
        <div className="pointer-events-none absolute inset-x-4 top-4 rounded-2xl glass border border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Arrivée estimée</p>
              <p className="text-2xl font-bold text-text">{arrival}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-text-secondary">Temps restant</p>
              <p className="text-2xl font-bold text-success">{order.etaMinutes} min</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-6">
        <div className="mb-6 card-premium p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-muted text-sm font-bold text-brand">
              {(order.driverName ?? "Karim D.").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-text">{order.driverName ?? "Karim D."}</p>
              <p className="text-sm text-text-secondary">Votre livreur · Note 4,9</p>
            </div>
            <div className="flex gap-2">
              <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-surface-tertiary" aria-label="Appeler">
                <Phone className="h-4 w-4" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-surface-tertiary" aria-label="Message">
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-text">Suivi de livraison</h2>
          <div className="space-y-0">
            {STEPS.map((step, index) => {
              const rank = ORDER_RANK[step.status];
              const completed = rank < currentRank;
              const active = rank === currentRank;
              return (
                <div key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={clsx(
                        "flex h-7 w-7 items-center justify-center rounded-full border-2",
                        completed
                          ? "border-success bg-success text-white"
                          : active
                            ? "border-brand bg-brand text-white"
                            : "border-border bg-white text-text-tertiary"
                      )}
                    >
                      {completed ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : active ? (
                        <Clock className="h-3.5 w-3.5" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-border" />
                      )}
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={clsx("min-h-[24px] w-0.5 flex-1", completed ? "bg-success" : "bg-border")} />
                    )}
                  </div>
                  <div className={clsx("pb-5", index === STEPS.length - 1 && "pb-0")}>
                    <p
                      className={clsx(
                        "text-sm font-medium",
                        active ? "text-brand" : completed ? "text-text" : "text-text-tertiary"
                      )}
                    >
                      {step.label}
                    </p>
                    {active && (
                      <p className="mt-0.5 text-xs font-medium text-success">
                        En cours · Arrivée dans {order.etaMinutes} min
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card-premium p-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.productImage}
              alt={order.productName}
              className="h-12 w-12 rounded-lg object-cover"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold">{order.productName}</p>
              <p className="text-xs text-text-secondary">{order.storeName} · {order.id}</p>
            </div>
            <span className="text-sm font-bold">{order.price} €</span>
          </div>
        </div>
      </div>
    </div>
  );
}
