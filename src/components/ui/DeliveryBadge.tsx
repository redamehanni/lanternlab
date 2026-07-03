import { Clock, Zap } from "lucide-react";
import { clsx } from "clsx";

interface DeliveryBadgeProps {
  minutes: number;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "hero";
}

export function DeliveryBadge({ minutes, size = "md", variant = "default" }: DeliveryBadgeProps) {
  if (variant === "hero") {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl bg-success-light px-5 py-3">
        <Zap className="h-5 w-5 text-success" fill="currentColor" />
        <div>
          <p className="text-xs font-medium text-success/70">Livré chez vous en</p>
          <p className="text-2xl font-bold text-success">{minutes} min</p>
        </div>
      </div>
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full bg-success-light font-semibold text-success",
        size === "sm" && "px-2.5 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base"
      )}
    >
      <Clock className={clsx(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      Livraison {minutes} min
    </span>
  );
}
