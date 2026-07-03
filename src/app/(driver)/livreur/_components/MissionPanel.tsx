"use client";

import { useState, useTransition } from "react";
import { Navigation, MapPin, Package, User, Phone, Clock, CheckCircle2 } from "lucide-react";
import type { DriverMission } from "@/lib/types";
import { acceptMission } from "../actions";

export function MissionPanel({
  isOnline,
  mission,
}: {
  isOnline: boolean;
  mission: DriverMission | null;
}) {
  const [accepted, setAccepted] = useState(false);
  const [, startTransition] = useTransition();

  if (!isOnline) {
    return (
      <div className="flex flex-col items-center px-6 py-6 text-center">
        <p className="text-base font-semibold text-text">Vous êtes hors ligne</p>
        <p className="mt-1 text-sm text-text-secondary">
          Passez en ligne pour recevoir des missions dans votre zone.
        </p>
        <div className="mt-5 grid w-full grid-cols-2 gap-3 text-left">
          <div className="card-premium p-4">
            <p className="text-xs text-text-tertiary">Aujourd&apos;hui</p>
            <p className="mt-1 text-xl font-bold text-text">47,50 €</p>
            <p className="text-xs text-text-secondary">6 livraisons</p>
          </div>
          <div className="card-premium p-4">
            <p className="text-xs text-text-tertiary">Cette semaine</p>
            <p className="mt-1 text-xl font-bold text-text">426,50 €</p>
            <p className="text-xs text-text-secondary">54 livraisons</p>
          </div>
        </div>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-base font-semibold text-text">Recherche de missions...</p>
        <p className="mt-1 text-sm text-text-secondary">
          Restez en ligne, une course va bientôt arriver.
        </p>
      </div>
    );
  }

  function accept() {
    setAccepted(true);
    startTransition(() => {
      acceptMission(mission!.id);
    });
  }

  return (
    <div className="px-5 py-4">
      <div className="rounded-2xl border border-brand/20 bg-brand-muted p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
            <p className="text-sm font-semibold text-brand">
              {accepted ? "Mission acceptée" : "Nouvelle mission"}
            </p>
          </div>
          <span className="rounded-full bg-success-light px-2.5 py-0.5 text-xs font-bold text-success">
            {mission.earnings.toFixed(2)} €
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-3 rounded-xl bg-white p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">1</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">Commerce</p>
              <p className="truncate text-sm font-semibold text-text">{mission.storeName}</p>
              <p className="text-xs text-text-secondary">{mission.storeAddress}</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              <MapPin className="h-3.5 w-3.5" />
              {mission.distance}
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-white p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-xs font-bold text-text-secondary">2</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mission.productImage} alt={mission.productName} className="h-10 w-10 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Produit</p>
              <p className="truncate text-sm font-semibold text-text">{mission.productName}</p>
            </div>
            <Package className="h-4 w-4 text-text-tertiary" />
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-white p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-xs font-bold text-text-secondary">3</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Client</p>
              <p className="truncate text-sm font-semibold text-text">{mission.customerName}</p>
              <p className="text-xs text-text-secondary">{mission.customerAddress}</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              <Clock className="h-3.5 w-3.5" />
              {mission.deliveryMinutes} min
            </span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {accepted ? (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success py-2.5 text-sm font-semibold text-white">
              <CheckCircle2 className="h-4 w-4" />
              En route vers {mission.storeName}
            </div>
          ) : (
            <>
              <button onClick={accept} className="btn-primary flex-1 py-2.5 text-sm">
                <Navigation className="h-4 w-4" />
                Accepter
              </button>
              <button className="btn-secondary px-4 py-2.5 text-sm">Refuser</button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Aujourd'hui", value: "47,50 €" },
          { label: "Livraisons", value: "6" },
          { label: "Moy. / course", value: "7,92 €" },
        ].map(({ label, value }) => (
          <div key={label} className="card-premium p-3 text-center">
            <p className="text-sm font-bold text-text">{value}</p>
            <p className="text-[10px] text-text-tertiary">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-border-light p-3">
        <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-tertiary">
          <Phone className="h-3.5 w-3.5" />
          Appeler le client
        </button>
        <span className="flex items-center gap-1 text-xs text-text-tertiary">
          <User className="h-3.5 w-3.5" />
          {mission.customerName}
        </span>
      </div>
    </div>
  );
}
