import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { searchListings } from "@/lib/data";
import { DeliveryBadge } from "@/components/ui/DeliveryBadge";
import { SearchBar } from "@/components/ui/SearchBar";

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "Nintendo Switch" } = await searchParams;
  const { product, listings } = await searchListings(q);

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white hover:bg-surface-tertiary"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <SearchBar defaultValue={q} />
        </div>
      </div>

      {!product || listings.length === 0 ? (
        <div className="card-premium flex flex-col items-center gap-3 px-6 py-16 text-center">
          <SearchX className="h-10 w-10 text-text-tertiary" />
          <p className="font-semibold text-text">Aucun résultat pour « {q} »</p>
          <p className="text-sm text-text-secondary">
            Essayez un autre produit disponible dans votre zone.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">
                {listings.length} commerce{listings.length > 1 ? "s" : ""} · Stock disponible
              </p>
              <p className="mt-0.5 text-xs font-medium text-success">
                Trié par temps de livraison
              </p>
            </div>
            <div className="rounded-full bg-success-light px-3 py-1 text-xs font-semibold text-success">
              Dès {listings[0].deliveryMinutes} min
            </div>
          </div>

          <div className="card-premium mb-6 flex items-center gap-4 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.name}
              className="h-16 w-16 rounded-xl object-cover"
            />
            <div>
              <h1 className="font-semibold text-text">{product.name}</h1>
              <p className="text-sm text-text-secondary">{product.category}</p>
            </div>
          </div>

          <div className="space-y-3">
            {listings.map((listing, index) => (
              <div
                key={listing.id}
                className="card-premium overflow-hidden transition-all hover:border-brand/20"
              >
                <div className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-sm font-bold text-brand">
                    {listing.storeName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-text">{listing.storeName}</h3>
                          {index === 0 && (
                            <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                              Plus rapide
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-text-secondary">{listing.storeType}</p>
                      </div>
                      <span className="text-lg font-bold text-text">{listing.price} €</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <DeliveryBadge minutes={listing.deliveryMinutes} size="lg" />
                      <div className="text-right text-xs text-text-tertiary">
                        <span>{listing.distance}</span>
                        <span className="mx-1.5">·</span>
                        <span className="font-medium text-success">{listing.stock} en stock</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-border-light bg-surface-secondary p-3">
                  <Link
                    href={`/commande/mode?product=${listing.productId}&store=${listing.storeId}&mode=delivery`}
                    className="btn-primary flex-1 py-2.5 text-sm"
                  >
                    Se faire livrer
                  </Link>
                  <Link
                    href={`/commande/mode?product=${listing.productId}&store=${listing.storeId}&mode=pickup`}
                    className="btn-secondary flex-1 py-2.5 text-sm"
                  >
                    Retirer en magasin
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
