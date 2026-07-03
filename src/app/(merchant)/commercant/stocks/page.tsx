import Link from "next/link";
import { ArrowLeft, Plus, RefreshCw, Search } from "lucide-react";
import { getStockItems } from "@/lib/data";
import { StockTable } from "./StockTable";

export default async function StockManagementPage() {
  const items = await getStockItems();

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/commercant"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white hover:bg-surface-tertiary"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-text">Gestion des stocks</h1>
            <p className="text-sm text-text-secondary">
              {items.length} produits · Synchronisation temps réel
            </p>
          </div>
        </div>
        <button className="btn-primary py-2.5">
          <Plus className="h-4 w-4" />
          Ajouter un produit
        </button>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-xl bg-success-light px-5 py-3">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-4 w-4 text-success" />
          <div>
            <p className="text-sm font-semibold text-success">Synchronisation active</p>
            <p className="text-xs text-success/70">Dernière mise à jour : il y a 1 min</p>
          </div>
        </div>
        <span className="hidden font-mono text-xs text-success/70 sm:block">POS · Shopify · ERP</span>
      </div>

      <div className="mb-6 flex gap-3">
        <div className="input-search flex flex-1 items-center gap-3 py-3">
          <Search className="h-4 w-4 text-text-tertiary" />
          <span className="text-sm text-text-tertiary">Rechercher un produit...</span>
        </div>
        <select className="rounded-xl border border-border bg-white px-4 text-sm text-text-secondary">
          <option>Tous</option>
          <option>En stock</option>
          <option>Rupture</option>
        </select>
      </div>

      <StockTable items={items} />

      <div className="mt-8 card-premium p-6">
        <h2 className="mb-4 text-sm font-semibold text-text">Ajouter un produit</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Nom du produit</label>
            <input type="text" placeholder="Ex : Manette Pro Switch" className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">SKU</label>
            <input type="text" placeholder="Ex : NSW-006" className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Prix (€)</label>
            <input type="number" placeholder="0.00" className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Stock initial</label>
            <input type="number" placeholder="0" className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:border-brand focus:outline-none" />
          </div>
        </div>
        <button className="btn-primary mt-4">Enregistrer le produit</button>
      </div>
    </div>
  );
}
