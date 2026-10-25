import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Five stars filled to the rating, with an optional review count. */
export function Stars({
  rating,
  count,
  size = "sm",
  className,
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const icon = size === "md" ? "size-4" : "size-3";
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="inline-flex" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            aria-hidden
            className={cn(icon, rating >= n - 0.25 ? "fill-gold text-gold" : rating >= n - 0.75 ? "fill-gold/50 text-gold" : "text-stone")}
          />
        ))}
      </span>
      {count !== undefined ? <span className="text-[11px] text-mist">({count})</span> : null}
    </span>
  );
}
