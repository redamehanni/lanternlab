import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Package, Store } from "lucide-react";
import { getProductDetail } from "@/lib/data";
import { DeliveryBadge } from "@/components/ui/DeliveryBadge";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductDetail(id);
  if (!product || product.listings.length === 0) notFound();

  const best = product.listings[0];
  const others = product.listings.slice(1);
  const orderHref = `/commande/mode?product=${product.id}&store=${best.storeId}`;

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <div className="relative aspect-[4/3] bg-surface-tertiary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        <Link
          href="/recherche"
          className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl glass border border-border"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="absolute bottom-4 left-4">
          <DeliveryBadge minutes={best.deliveryMinutes} size="md" />
        </div>
      </div>

      <div className="px-5 py-6 sm:px-6">
        <div className="mb-6">
          <p className="mb-1 text-sm font-medium text-brand">{product.category}</p>
          <h1 className="mb-2 text-2xl font-bold text-text">{product.name}</h1>
          <p className="text-3xl font-bold text-text">{best.price} €</p>
        </div>

        <div className="mb-6 rounded-2xl border-2 border-success/20 bg-success-light p-5">
          <DeliveryBadge minutes={best.deliveryMinutes} variant="hero" />
          <p className="mt-3 text-sm text-text-secondary">
            Depuis <span className="font-medium text-text">{best.storeName}</span> ·{" "}
            {best.distance} · {best.stock} en stock
          </p>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-3">
          <div className="card-premium p-4 text-center">
            <Store className="mx-auto mb-2 h-5 w-5 text-brand" />
            <p className="text-xs text-text-tertiary">Commerce</p>
            <p className="truncate text-sm font-semibold text-text">{best.storeName}</p>
          </div>
          <div className="card-premium p-4 text-center">
            <MapPin className="mx-auto mb-2 h-5 w-5 text-brand" />
            <p className="text-xs text-text-tertiary">Distance</p>
            <p className="text-sm font-semibold text-text">{best.distance}</p>
          </div>
          <div className="card-premium p-4 text-center">
            <Package className="mx-auto mb-2 h-5 w-5 text-success" />
            <p className="text-xs text-text-tertiary">Stock</p>
            <p className="text-sm font-semibold text-success">{best.stock} dispo.</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-text">Description</h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            {product.name} disponible immédiatement chez {best.storeName}, à {best.distance} de
            chez vous. Faites-vous livrer en {best.deliveryMinutes} minutes ou retirez en magasin.
          </p>
        </div>

        {others.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-text">Autres commerces</h2>
            <div className="space-y-2">
              {others.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/commande/mode?product=${product.id}&store=${listing.storeId}`}
                  className="flex items-center justify-between rounded-xl border border-border-light p-3 transition-colors hover:bg-surface-secondary"
                >
                  <span className="text-sm font-medium">{listing.storeName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold">{listing.price} €</span>
                    <DeliveryBadge minutes={listing.deliveryMinutes} size="sm" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white px-5 py-4">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Link href={`${orderHref}&mode=delivery`} className="btn-primary flex-1">
            Commander maintenant
          </Link>
          <Link href={`${orderHref}&mode=pickup`} className="btn-secondary">
            Retrait magasin
          </Link>
        </div>
      </div>
    </div>
  );
}
