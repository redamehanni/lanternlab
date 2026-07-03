"use client";

import {
  X,
  Star,
  ChevronRight,
  User,
  FileText,
  Car,
  Clock,
  Settings,
  HelpCircle,
  Headphones,
  LogOut,
} from "lucide-react";

const MENU_ITEMS = [
  { icon: User, label: "Mon profil", desc: "Karim D. · Note 4,9" },
  { icon: FileText, label: "Mes documents", desc: "Permis, assurance à jour" },
  { icon: Car, label: "Mon véhicule", desc: "Vélo électrique · Paris" },
  { icon: Clock, label: "Historique des livraisons", desc: "54 courses effectuées" },
  { icon: Settings, label: "Paramètres", desc: "Notifications, compte" },
  { icon: HelpCircle, label: "Centre d'aide", desc: "FAQ et guides livreur" },
  { icon: Headphones, label: "Support", desc: "Disponible 7j/7, 8h–22h" },
];

export function MenuDrawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[1200] flex w-72 flex-col overflow-hidden bg-white">
        <div className="relative bg-brand px-6 pb-6 pt-10">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-xl font-bold text-white">
              KD
            </div>
            <div>
              <p className="font-semibold text-white">Karim Diouf</p>
              <div className="mt-0.5 flex items-center gap-1 text-sm text-white/70">
                <Star className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" />
                <span>4,9 · Livreur vérifié</span>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/10 px-3 py-2.5">
              <p className="text-xs text-white/50">Cette semaine</p>
              <p className="text-lg font-bold text-white">426,50 €</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2.5">
              <p className="text-xs text-white/50">Livraisons</p>
              <p className="text-lg font-bold text-white">54</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {MENU_ITEMS.map(({ icon: Icon, label, desc }) => (
            <button
              key={label}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-secondary"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-tertiary">
                <Icon className="h-4 w-4 text-text-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{label}</p>
                <p className="text-xs text-text-tertiary">{desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
            </button>
          ))}
        </nav>

        <form action="/auth/signout" method="post" className="border-t border-border-light p-4">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-50">
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </form>
      </div>
    </>
  );
}
