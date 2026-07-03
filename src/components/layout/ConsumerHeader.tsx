"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, User } from "lucide-react";
import { clsx } from "clsx";
import { Logo } from "@/components/ui/Logo";

const TABS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/carte", label: "Carte", icon: Map },
  { href: "/connexion", label: "Compte", icon: User },
];

export function ConsumerHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-light bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
        <Logo />
        <Link
          href="/connexion"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:bg-surface-tertiary"
          aria-label="Mon compte"
        >
          <User className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}

export function ConsumerTabBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-30 border-t border-border bg-white/95 backdrop-blur-xl sm:hidden">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-brand" : "text-text-tertiary"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
