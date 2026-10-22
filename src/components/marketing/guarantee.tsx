import { ShieldCheck } from "lucide-react";
import { guarantee } from "@/lib/site-content";
import { cn } from "@/lib/utils";

/** The first-month money-back promise on the registration fee. */
export function GuaranteeBanner({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border-2 border-dashed p-6 sm:flex-row sm:items-center sm:p-7",
        tone === "dark" ? "border-gold/50 bg-gold/10" : "border-gold/60 bg-gold/10",
        className,
      )}
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gold text-navy">
        <ShieldCheck className="size-7" strokeWidth={1.8} />
      </span>
      <div>
        <p className={cn("font-display text-xl font-extrabold", tone === "dark" ? "text-white" : "text-navy")}>
          {guarantee.title}
        </p>
        <p className={cn("mt-1 text-[15px] leading-relaxed", tone === "dark" ? "text-white/80" : "text-graphite")}>
          {guarantee.body}
        </p>
      </div>
    </div>
  );
}

/** Small pill version, for hero sections and forms. */
export function GuaranteeBadge({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
        tone === "dark" ? "bg-gold/15 text-gold-300" : "bg-gold/15 text-navy",
      )}
    >
      <ShieldCheck className="size-3.5" />
      {guarantee.badge}
    </span>
  );
}
