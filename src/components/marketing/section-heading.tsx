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

/** Small gold label over a large display heading, as on every marketing section. */
export function SectionLabel({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em]",
        tone === "dark" ? "text-gold-300" : "text-teal-700",
      )}
    >
      <span className="h-0.5 w-7 rounded-full bg-gold" aria-hidden />
      {children}
    </span>
  );
}

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
        "flex flex-col gap-4",
        align === "center" && "mx-auto max-w-2xl items-center text-center",
        className,
      )}
    >
      <SectionLabel tone={tone}>{label}</SectionLabel>
      <h2
        className={cn(
          "font-display text-3xl leading-[1.12] font-extrabold tracking-tight text-balance sm:text-[2.6rem]",
          tone === "dark" ? "text-white" : "text-navy",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-xl text-base leading-relaxed sm:text-lg",
            tone === "dark" ? "text-mist" : "text-graphite",
          )}
        >
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
