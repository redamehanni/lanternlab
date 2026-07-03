import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck, Store, Clock, MapPin, ChevronRight } from "lucide-react";
import { getProductDetail } from "@/lib/data";
import { placeOrder } from "../actions";

const DELIVERY_FEE = 3.99;

export default async function FulfillmentModePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; store?: string; mode?: string }>;
}) {
  const { product: productId, store: storeId } = await searchParams;
  if (!productId || !storeId) notFound();

  const product = await getProductDetail(productId);
  const listing = product?.listings.find((l) => l.storeId === storeId);
  if (!product || !listing) notFound();

  return (
    <div className="mx-auto max-w-lg px-5 py-6 sm:py-8">
      <div className="mb-8 flex items-center gap-4">
        <Link
          href={`/produit/${product.id}`}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white hover:bg-surface-tertiary"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-text">Mode de récupération</h1>
          <p className="text-sm text-text-secondary">
            {product.name} · {listing.price} €
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <form action={placeOrder}>
          <input type="hidden" name="product" value={product.id} />
          <input type="hidden" name="store" value={listing.storeId} />
          <input type="hidden" name="fulfillment" value="delivery" />
          <input type="hidden" name="address" value="8 avenue de l'Opéra, 75001 Paris" />
          <button
            type="submit"
            className="block w-full rounded-2xl border-2 border-brand bg-brand-muted p-5 text-left transition-all hover:border-brand-light"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
                <Truck className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-text">Livraison rapide</h2>
                  <ChevronRight className="h-5 w-5 text-brand" />
                </div>
                <p className="mt-1 text-2xl font-bold text-success">
                  Livré en {listing.deliveryMinutes} min
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  Depuis {listing.storeName} · Livraison à domicile
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-text-tertiary">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />8 avenue de l&apos;Opéra
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Frais : {DELIVERY_FEE.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white">
              Recommandé · Plus rapide qu&apos;Amazon
            </div>
          </button>
        </form>

        <form action={placeOrder}>
          <input type="hidden" name="product" value={product.id} />
          <input type="hidden" name="store" value={listing.storeId} />
          <input type="hidden" name="fulfillment" value="pickup" />
          <button
            type="submit"
            className="block w-full rounded-2xl border border-border bg-white p-5 text-left transition-all hover:border-brand/20"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-tertiary text-text-secondary">
                <Store className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-text">Retrait magasin</h2>
                  <ChevronRight className="h-5 w-5 text-text-tertiary" />
                </div>
                <p className="mt-1 text-lg font-semibold text-text">Disponible immédiatement</p>
                <p className="mt-2 text-sm text-text-secondary">
                  {listing.storeName} · {listing.address} · {listing.distance}
                </p>
              </div>
            </div>
          </button>
        </form>
      </div>

      <div className="mt-8 card-premium p-5">
        <h3 className="mb-4 text-sm font-semibold text-text">Récapitulatif</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">{product.name}</span>
            <span className="font-medium">{listing.price.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Livraison express</span>
            <span className="font-medium">{DELIVERY_FEE.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between border-t border-border-light pt-2">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold">
              {(listing.price + DELIVERY_FEE).toFixed(2)} €
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
