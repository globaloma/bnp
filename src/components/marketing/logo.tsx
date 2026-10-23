import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { company } from "@/lib/site-content";

export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/bnp-icon.png"
      alt=""
      width={256}
      height={256}
      className={cn("size-full", className)}
      priority
    />
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
        <span
          className={cn(
            "mt-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
            tone === "dark" ? "text-teal-300" : "text-teal-700",
          )}
        >
          Operations partner
        </span>
      </span>
    </Link>
  );
}
