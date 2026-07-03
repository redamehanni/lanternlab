"use client";

import { useState, useTransition } from "react";
import { Navigation, Star } from "lucide-react";
import type { DriverMission } from "@/lib/types";
import { DriverMap } from "./DriverMap";
import { OnlineToggle } from "./OnlineToggle";
import { MissionPanel } from "./MissionPanel";
import { EarningsPanel } from "./EarningsPanel";
import { InboxPanel } from "./InboxPanel";
import { MenuDrawer } from "./MenuDrawer";
import { BottomNav, type DriverTab, type DriverNavTarget } from "./BottomNav";
import { setDriverOnline } from "../actions";

export function DriverApp({ missions }: { missions: DriverMission[] }) {
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState<DriverTab>("map");
  const [menuOpen, setMenuOpen] = useState(false);
  const [, startTransition] = useTransition();

  function toggleOnline() {
    const next = !isOnline;
    setIsOnline(next);
    startTransition(() => {
      setDriverOnline(next);
    });
  }

  function handleNav(target: DriverNavTarget) {
    if (target === "menu") setMenuOpen(true);
    else setActiveTab(target);
  }

  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-white">
      <div className="relative shrink-0" style={{ height: "60dvh" }}>
        <DriverMap isOnline={isOnline} missions={missions} />

        <div className="absolute inset-x-4 top-4 z-[1000]">
          <div className="glass flex items-center gap-3 rounded-2xl border border-border px-4 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              KD
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">Karim Diouf</p>
              <p className="text-xs text-text-secondary">Paris 1er · Vélo électrique</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Star className="h-3.5 w-3.5 text-yellow-500" fill="currentColor" />
              <span className="text-sm font-semibold text-text">4,9</span>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 top-[72px] z-[1000] -translate-x-1/2">
          <OnlineToggle isOnline={isOnline} onToggle={toggleOnline} />
        </div>

        <div className="absolute bottom-4 right-4 z-[1000]">
          <button className="glass flex h-11 w-11 items-center justify-center rounded-xl border border-border" aria-label="Me localiser">
            <Navigation className="h-5 w-5 text-brand" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "map" && <MissionPanel isOnline={isOnline} mission={missions[0] ?? null} />}
        {activeTab === "earnings" && <EarningsPanel />}
        {activeTab === "inbox" && <InboxPanel />}
      </div>

      <BottomNav activeTab={activeTab} unreadCount={2} onSelect={handleNav} />

      {menuOpen && <MenuDrawer onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
