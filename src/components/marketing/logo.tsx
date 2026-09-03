import Link from "next/link";
import { cn } from "@/lib/utils";
import { company } from "@/lib/site-content";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={cn("size-full", className)}
      aria-hidden
    >
      <rect width="40" height="40" rx="10" fill="#2E8B9A" />
      <path
        d="M11 15.5 20 11l9 4.5v9L20 29l-9-4.5v-9Z"
        fill="#F8F5F0"
        fillOpacity="0.12"
        stroke="#F8F5F0"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m11 15.5 9 4.5 9-4.5M20 20v9"
        stroke="#F8F5F0"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="24.5" cy="14" r="2.4" fill="#E8A020" />
    </svg>
  );
}

export function Logo({
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2.5", className)}
      aria-label={`${company.name} home`}
    >
      <span className="size-9">
        <LogoMark />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-sm font-semibold tracking-tight",
            tone === "dark" ? "text-white" : "text-navy",
          )}
        >
          {company.name}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-300">
          Operations partner
        </span>
      </span>
    </Link>
  );
}
