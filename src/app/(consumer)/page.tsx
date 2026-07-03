import Link from "next/link";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { SEARCH_SUGGESTIONS } from "@/lib/demo-data";
import { getNearbyProducts } from "@/lib/data";
import { DeliveryBadge } from "@/components/ui/DeliveryBadge";
import { SearchBar } from "@/components/ui/SearchBar";

export default async function HomePage() {
  const nearbyProducts = await getNearbyProducts();
  const availableCount = nearbyProducts.length * 141 + 6;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
      <header className="mb-8 flex items-center justify-between sm:mb-10">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <MapPin className="h-4 w-4 text-brand" />
          <span>Paris 1er · 75001</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-success-light px-3 py-1 text-xs font-semibold text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          {availableCount} produits disponibles
        </div>
      </header>

      <section className="mb-8 text-center sm:mb-10">
        <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-text sm:text-[2rem]">
          Trouvez ce dont vous avez besoin
          <br />
          <span className="text-brand">autour de vous</span>
        </h1>
        <p className="text-base text-text-secondary">
          Livré dans l&apos;heure par un commerçant de votre ville
        </p>
      </section>

      <section className="mb-8">
        <SearchBar />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SEARCH_SUGGESTIONS.map((suggestion) => (
            <Link
              key={suggestion}
              href={`/recherche?q=${encodeURIComponent(suggestion)}`}
              className="rounded-full border border-border bg-white px-3.5 py-1.5 text-sm text-text-secondary transition-colors hover:border-brand/30 hover:text-brand"
            >
              {suggestion}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-10 rounded-2xl bg-brand px-6 py-5 text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/70">Promesse Ma Zone</p>
            <p className="mt-1 text-lg font-semibold">
              Pourquoi attendre demain ce qui est déjà dans votre zone ?
            </p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <Clock className="h-7 w-7" />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">
              Disponible près de vous maintenant
            </h2>
            <p className="text-sm text-text-secondary">Stock local · Livraison express</p>
          </div>
          <Link
            href="/carte"
            className="flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            Voir la carte
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {nearbyProducts.map((product) => (
            <Link
              key={product.id}
              href={`/produit/${product.id}`}
              className="card-premium group overflow-hidden transition-all hover:border-brand/20"
            >
              <div className="relative aspect-square overflow-hidden bg-surface-tertiary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute left-2 top-2">
                  <DeliveryBadge minutes={product.deliveryMinutes} size="sm" />
                </div>
              </div>
              <div className="p-3">
                <p className="mb-1 line-clamp-2 text-sm font-medium leading-snug text-text">
                  {product.name}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-text">{product.price} €</span>
                  <span className="text-xs text-text-tertiary">{product.distance}</span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">{product.storeName}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 flex items-center justify-center gap-4 text-sm text-text-tertiary">
        <span className="font-medium text-brand">Rechercher</span>
        <ChevronRight className="h-4 w-4" />
        <span>Commander</span>
        <ChevronRight className="h-4 w-4" />
        <span>Être livré</span>
      </section>
    </div>
  );
}
