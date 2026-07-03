"use client";

import { clsx } from "clsx";

export function OnlineToggle({
  isOnline,
  onToggle,
}: {
  isOnline: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={clsx(
        "flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-semibold shadow-[0_2px_14px_rgba(0,0,0,0.18)] transition-all active:scale-95",
        isOnline ? "bg-white text-text" : "bg-brand text-white"
      )}
    >
      <span
        className={clsx(
          "h-2 w-2 rounded-full",
          isOnline ? "animate-pulse bg-success" : "bg-white/40"
        )}
      />
      {isOnline ? "En ligne · Appuyer pour vous déconnecter" : "Passer en ligne"}
    </button>
  );
}
