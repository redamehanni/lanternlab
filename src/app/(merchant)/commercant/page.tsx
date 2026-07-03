import Link from "next/link";
import {
  Package,
  ShoppingBag,
  TrendingUp,
  Clock,
  ChevronRight,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { clsx } from "clsx";
import { getMerchantOrders } from "@/lib/data";
import { OrdersRealtime } from "@/components/realtime/OrdersRealtime";
import type { OrderStatus } from "@/lib/types";

const STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-50 text-amber-700" },
  preparing: { label: "En préparation", color: "bg-blue-50 text-blue-700" },
  ready: { label: "Prête", color: "bg-success-light text-success" },
  assigned: { label: "Assignée", color: "bg-blue-50 text-blue-700" },
  picked_up: { label: "Récupérée", color: "bg-blue-50 text-blue-700" },
  delivering: { label: "En livraison", color: "bg-blue-50 text-blue-700" },
  delivered: { label: "Livrée", color: "bg-surface-tertiary text-text-secondary" },
  cancelled: { label: "Annulée", color: "bg-red-50 text-red-600" },
};

export default async function MerchantDashboardPage() {
  const orders = await getMerchantOrders();
  const pending = orders.filter((o) => o.status === "pending").length;
  const revenue = 4280;

  const stats = [
    { label: "Commandes aujourd'hui", value: orders.length, icon: ShoppingBag },
    { label: "Chiffre d'affaires", value: `${revenue} €`, icon: TrendingUp },
    { label: "Temps moy. livraison", value: "22 min", icon: Clock },
    { label: "Sync stock", value: "99,2 %", icon: Package },
  ];

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-6">
      <OrdersRealtime />

      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-brand">Espace commerçant</p>
          <h1 className="text-2xl font-bold text-text">Boutique Gaming</h1>
          <p className="text-sm text-text-secondary">12 rue de Rivoli, 75004 Paris</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-success-light px-3 py-1.5 text-xs font-semibold text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Stock synchronisé
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card-premium p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-muted">
              <Icon className="h-4 w-4 text-brand" />
            </div>
            <p className="text-2xl font-bold text-text">{value}</p>
            <p className="mt-1 text-xs text-text-secondary">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/commercant/stocks"
          className="card-premium flex items-center justify-between p-4 transition-colors hover:border-brand/20"
        >
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-brand" />
            <span className="text-sm font-medium">Gérer les stocks</span>
          </div>
          <ChevronRight className="h-4 w-4 text-text-tertiary" />
        </Link>
        <div className="card-premium flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-brand" />
            <div>
              <span className="text-sm font-medium">Réservations</span>
              <p className="text-xs text-text-secondary">7 actives</p>
            </div>
          </div>
          <span className="rounded-full bg-brand-muted px-2.5 py-0.5 text-xs font-bold text-brand">7</span>
        </div>
        <div className="card-premium flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div>
              <span className="text-sm font-medium">En attente</span>
              <p className="text-xs text-text-secondary">{pending} commandes</p>
            </div>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
            {pending}
          </span>
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <h2 className="font-semibold text-text">Commandes récentes</h2>
          <span className="text-xs text-text-tertiary">Temps réel</span>
        </div>
        <div className="divide-y divide-border-light">
          {orders.map((order) => {
            const meta = STATUS_META[order.status];
            return (
              <div key={order.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text">{order.productName}</p>
                    <span
                      className={clsx(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        order.fulfillment === "delivery"
                          ? "bg-brand-muted text-brand"
                          : "bg-surface-tertiary text-text-secondary"
                      )}
                    >
                      {order.fulfillment === "delivery" ? "Livraison" : "Retrait"}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    {order.customerName} · {order.id} · {order.time}
                  </p>
                </div>
                <span className={clsx("rounded-full px-2.5 py-1 text-xs font-medium", meta.color)}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
