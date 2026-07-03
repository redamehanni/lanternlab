import Link from "next/link";
import { clsx } from "clsx";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={clsx("flex items-center gap-2.5", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
        <span className="text-sm font-bold text-white">MZ</span>
      </div>
      <span className="text-lg font-semibold tracking-tight text-text">
        Ma Zone
      </span>
    </Link>
  );
}
