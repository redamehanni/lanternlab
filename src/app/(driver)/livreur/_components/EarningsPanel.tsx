"use client";

import { CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";

const WEEK_DATA = [
  { day: "Lun", amount: 52 },
  { day: "Mar", amount: 38 },
  { day: "Mer", amount: 67 },
  { day: "Jeu", amount: 45 },
  { day: "Ven", amount: 82 },
  { day: "Sam", amount: 95 },
  { day: "Auj.", amount: 47.5 },
];
const MAX_AMOUNT = Math.max(...WEEK_DATA.map((d) => d.amount));

const TODAY_DELIVERIES = [
  { time: "14:22", store: "Boutique Gaming", amount: 8.5 },
  { time: "13:10", store: "Carrefour", amount: 7.0 },
  { time: "12:05", store: "Fnac", amount: 9.5 },
  { time: "11:30", store: "Apple Store", amount: 6.5 },
  { time: "10:55", store: "Boulanger", amount: 8.0 },
  { time: "09:20", store: "Micromania", amount: 8.0 },
];

export function EarningsPanel() {
  return (
    <div className="space-y-4 px-5 py-5">
      <div className="rounded-2xl bg-brand p-5 text-white">
        <p className="text-sm font-medium text-white/60">Cette semaine</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">426,50 €</p>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
          {[
            { label: "Livraisons", value: "54" },
            { label: "Moy./course", value: "7,90 €" },
            { label: "Heures actives", value: "28 h" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-white/50">{label}</p>
              <p className="mt-0.5 text-base font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card-premium p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Revenus par jour</h3>
          <span className="text-xs text-text-tertiary">7 derniers jours</span>
        </div>
        <div className="flex h-24 items-end gap-1.5">
          {WEEK_DATA.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={clsx("w-full rounded-t", d.day === "Auj." ? "bg-brand" : "bg-brand-muted")}
                style={{ height: `${(d.amount / MAX_AMOUNT) * 100}%` }}
              />
              <span className="text-[10px] text-text-tertiary">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="border-b border-border-light px-5 py-3.5">
          <h3 className="text-sm font-semibold text-text">Aujourd&apos;hui · 47,50 €</h3>
        </div>
        <div className="divide-y divide-border-light">
          {TODAY_DELIVERIES.map((d) => (
            <div key={d.time} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-light">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text">{d.store}</p>
                  <p className="text-xs text-text-tertiary">{d.time}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-text">+{d.amount.toFixed(2)} €</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
