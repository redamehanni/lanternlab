"use client";

import { Map as MapIcon, Wallet, MessageCircle, Menu as MenuIcon } from "lucide-react";
import { clsx } from "clsx";

export type DriverTab = "map" | "earnings" | "inbox";
export type DriverNavTarget = DriverTab | "menu";

const TABS: {
  id: DriverNavTarget;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "map", label: "Carte", icon: MapIcon },
  { id: "earnings", label: "Revenus", icon: Wallet },
  { id: "inbox", label: "Messages", icon: MessageCircle },
  { id: "menu", label: "Menu", icon: MenuIcon },
];

export function BottomNav({
  activeTab,
  unreadCount,
  onSelect,
}: {
  activeTab: DriverTab;
  unreadCount: number;
  onSelect: (target: DriverNavTarget) => void;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className="relative flex flex-1 flex-col items-center gap-1 py-3"
            >
              {active && (
                <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-brand" />
              )}
              <div className="relative">
                <Icon className={clsx("h-5 w-5", active ? "text-brand" : "text-text-tertiary")} />
                {id === "inbox" && unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span
                className={clsx(
                  "text-[11px] font-medium",
                  active ? "text-brand" : "text-text-tertiary"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
