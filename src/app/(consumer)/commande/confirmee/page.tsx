import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, MapPin } from "lucide-react";
import { getOrder } from "@/lib/data";
import { USER_LOCATION } from "@/lib/geo";
import { MapView } from "@/components/ui/MapView";

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) notFound();
  const order = await getOrder(orderId);
  if (!order) notFound();

  const arrival = new Date(Date.now() + order.etaMinutes * 60000).toLocaleTimeString(
    "fr-FR",
    { hour: "2-digit", minute: "2-digit" }
  );

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-light">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-text">Commande validée</h1>
        <p className="mt-2 text-text-secondary">
          Votre {order.productName} est en cours de préparation
        </p>
        <p className="mt-1 font-mono text-sm text-text-tertiary">{order.id}</p>
      </div>

      <div className="mb-6 rounded-2xl bg-brand p-6 text-center text-white">
        <p className="text-sm font-medium text-white/70">Arrivée estimée</p>
        <p className="mt-1 text-4xl font-bold">{arrival}</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm">
          <Clock className="h-4 w-4" />
          Dans {order.etaMinutes} minutes
        </div>
      </div>

      <div className="mb-6 card-premium p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-surface-tertiary" />
            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 animate-pulse rounded-full border-2 border-white bg-success" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-text">Recherche d&apos;un livreur...</p>
            <p className="text-sm text-text-secondary">Assignation en cours</p>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 animate-pulse rounded-full bg-brand"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <MapView
          className="h-48 rounded-2xl"
          center={[order.storeLat, order.storeLng]}
          zoom={14}
          markers={[
            { id: "store", lat: order.storeLat, lng: order.storeLng, label: order.storeName, variant: "store" },
            { id: "user", lat: USER_LOCATION.lat, lng: USER_LOCATION.lng, variant: "user" },
          ]}
        />
        <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
          <MapPin className="h-4 w-4 text-brand" />
          <span>{order.storeName} · {order.storeAddress}</span>
        </div>
      </div>

      <div className="card-premium p-5">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={order.productImage}
            alt={order.productName}
            className="h-14 w-14 rounded-xl object-cover"
          />
          <div className="flex-1">
            <p className="font-semibold text-text">{order.productName}</p>
            <p className="text-sm text-text-secondary">{order.storeName}</p>
          </div>
          <span className="font-bold text-text">{order.price} €</span>
        </div>
      </div>

      <Link href={`/commande/suivi?order=${order.id}`} className="btn-primary mt-6 w-full">
        Suivre ma livraison
      </Link>
    </div>
  );
}
