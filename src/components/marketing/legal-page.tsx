import type { ReactNode } from "react";
import Link from "next/link";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Shared layout for /terms and /privacy: title, date, contents list, sections. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
  related,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
  related: { href: string; label: string };
}) {
  return (
    <div className="bg-cream">
      <div className="container-page max-w-3xl py-14 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold text-navy sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-mist">Last updated {updated}</p>

        <div className="legal-prose mt-8 text-[15px] leading-relaxed text-graphite">{intro}</div>

        <nav
          aria-label="Contents"
          className="mt-8 rounded-xl border border-stone bg-white p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite">
            Contents
          </p>
          <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-teal-700 hover:underline">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 flex flex-col gap-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-lg font-semibold text-navy">
                {i + 1}. {s.title}
              </h2>
              <div className="legal-prose mt-3 text-[15px] leading-relaxed text-graphite">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-stone pt-6 text-sm text-mist">
          See also our{" "}
          <Link href={related.href} className="font-semibold text-teal-700 hover:underline">
            {related.label}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
