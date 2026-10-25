import { cn } from "@/lib/utils";

/** A seller's logo, or their initials on a coloured circle. */
export function SellerAvatar({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl: string | null;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "size-20 text-xl" : "size-14 text-base";
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className={cn(box, "rounded-full border border-stone bg-white object-cover")} />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className={cn(box, "flex items-center justify-center rounded-full bg-teal/15 font-bold text-teal-700")} aria-hidden>
      {initials || "B"}
    </span>
  );
}
