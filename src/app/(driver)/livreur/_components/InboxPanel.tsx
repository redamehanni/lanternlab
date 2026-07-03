"use client";

import { clsx } from "clsx";

const MESSAGES = [
  { id: "1", subject: "Nouvelle zone disponible", preview: "Le 11e arrondissement est maintenant disponible pour les livraisons. Profitez d'un bonus de bienvenue.", time: "10:30", unread: true },
  { id: "2", subject: "Votre note a augmenté", preview: "Votre note est passée à 4,9 étoiles. Continuez comme ça, vous faites partie des meilleurs livreurs.", time: "Hier", unread: true },
  { id: "3", subject: "Prime weekend activée", preview: "Ce weekend, gagnez +20 % sur chaque livraison entre 18h et 22h. Offre valable samedi et dimanche.", time: "Jeu.", unread: false },
  { id: "4", subject: "Mise à jour de l'application", preview: "La version 2.1 apporte de nouvelles fonctionnalités pour les livreurs. Mettez à jour dès maintenant.", time: "Mar.", unread: false },
];

export function InboxPanel() {
  return (
    <div className="px-5 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Messages</h3>
        <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">
          2 non lus
        </span>
      </div>
      <div className="space-y-2">
        {MESSAGES.map((msg) => (
          <div
            key={msg.id}
            className={clsx(
              "card-premium flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-surface-secondary/50",
              msg.unread && "border-brand/25"
            )}
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-muted">
              <span className="text-xs font-bold text-brand">MZ</span>
              {msg.unread && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className={clsx("text-sm leading-snug", msg.unread ? "font-semibold text-text" : "font-medium text-text-secondary")}>
                  {msg.subject}
                </p>
                <span className="shrink-0 text-[11px] text-text-tertiary">{msg.time}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                {msg.preview}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
