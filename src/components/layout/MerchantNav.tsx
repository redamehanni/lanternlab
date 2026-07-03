"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, Boxes, LogOut } from "lucide-react";
import { clsx } from "clsx";
import { Logo } from "@/components/ui/Logo";

const LINKS = [
  { href: "/commercant", label: "Dashboard", icon: Store },
  { href: "/commercant/stocks", label: "Stocks", icon: Boxes },
];

export function MerchantNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-white md:flex">
      <div className="border-b border-border-light p-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-brand-muted font-medium text-brand"
                  : "text-text-secondary hover:bg-surface-tertiary"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <form action="/auth/signout" method="post" className="border-t border-border-light p-3">
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-tertiary">
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </form>
    </aside>
  );
}

export function MerchantMobileBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-30 flex border-t border-border bg-white md:hidden">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
              active ? "text-brand" : "text-text-tertiary"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
