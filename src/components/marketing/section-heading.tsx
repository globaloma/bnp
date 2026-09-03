import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

type SectionHeadingProps = {
  label: string;
  title: string;
  description?: string;
  tone?: "light" | "dark";
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  label,
  title,
  description,
  tone = "light",
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.18em]",
          tone === "dark" ? "text-teal-300" : "text-teal",
        )}
      >
        {label}
      </span>
      <h2
        className={cn(
          "font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl",
          tone === "dark" ? "text-white" : "text-navy",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-xl text-base leading-relaxed",
            tone === "dark" ? "text-mist" : "text-graphite",
          )}
        >
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
