"use client";

import { useState, useTransition } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { clsx } from "clsx";
import { updateStockItem } from "../actions";
import type { StockItem } from "@/lib/types";

export function StockTable({ items }: { items: StockItem[] }) {
  const [rows, setRows] = useState(items);
  const [, startTransition] = useTransition();

  function persist(id: string, stock: number, available: boolean) {
    startTransition(() => {
      updateStockItem(id, stock, available);
    });
  }

  function setStock(id: string, stock: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, stock } : r)));
    const row = rows.find((r) => r.id === id);
    if (row) persist(id, stock, row.available);
  }

  function toggle(id: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, available: !r.available } : r))
    );
    const row = rows.find((r) => r.id === id);
    if (row) persist(id, row.stock, !row.available);
  }

  return (
    <div className="card-premium overflow-hidden">
      <div className="grid grid-cols-[1fr_90px_70px_90px_70px] gap-3 border-b border-border-light bg-surface-secondary px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-tertiary sm:px-5">
        <span>Produit</span>
        <span className="hidden sm:block">SKU</span>
        <span>Prix</span>
        <span>Stock</span>
        <span>Dispo.</span>
      </div>
      <div className="divide-y divide-border-light">
        {rows.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_90px_70px_90px_70px] items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-secondary/50 sm:px-5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{item.name}</p>
              <p className="text-xs text-text-tertiary">{item.lastSync}</p>
            </div>
            <span className="hidden font-mono text-xs text-text-secondary sm:block">
              {item.sku}
            </span>
            <span className="text-sm font-semibold">{item.price} €</span>
            <input
              type="number"
              min={0}
              value={item.stock}
              onChange={(e) => setStock(item.id, Number(e.target.value))}
              className="w-16 rounded-lg border border-border px-2 py-1 text-center text-sm focus:border-brand focus:outline-none"
            />
            <button onClick={() => toggle(item.id)} aria-label="Disponibilité">
              {item.available ? (
                <ToggleRight className="h-6 w-6 text-success" />
              ) : (
                <ToggleLeft className={clsx("h-6 w-6 text-text-tertiary")} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
