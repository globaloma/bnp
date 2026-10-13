import { cn } from "@/lib/utils";

/** The merchant's logo, or their first initial when they haven't added one. */
export function StoreAvatar({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const box = { sm: "size-8 text-sm", md: "size-12 text-lg", lg: "size-16 text-2xl" }[size];

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={cn(box, "shrink-0 rounded-lg border border-stone bg-white object-cover")}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        box,
        "flex shrink-0 items-center justify-center rounded-lg bg-teal font-semibold text-white",
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "S"}
    </span>
  );
}
