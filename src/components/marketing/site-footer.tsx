import Link from "next/link";
import { company, footer } from "@/lib/site-content";
import { LogoMark } from "./logo";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-navy">
      <div className="container-page py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="size-8">
                <LogoMark />
              </span>
              <span className="text-sm font-semibold text-white">
                {company.name}
              </span>
            </div>
            <p className="mt-3 text-xs font-medium text-teal-300">
              {company.tagline}
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-mist">
              {footer.description}
            </p>
          </div>

          {footer.columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-300">
                {column.title}
              </h3>
              <ul className="mt-3 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-mist transition-colors hover:text-teal-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-300">
              Contact
            </h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-mist">
              <li>
                <a
                  href={`tel:${company.phone}`}
                  className="transition-colors hover:text-teal-300"
                >
                  {company.phoneDisplay}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${company.email}`}
                  className="transition-colors hover:text-teal-300"
                >
                  {company.email}
                </a>
              </li>
              <li>
                <a
                  href={company.whatsapp}
                  className="transition-colors hover:text-teal-300"
                >
                  WhatsApp us
                </a>
              </li>
              <li>
                <Link
                  href="/login"
                  className="transition-colors hover:text-teal-300"
                >
                  Partner login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-mist">
            {year} {company.legalName}. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-mist">
            {company.locations.map((loc) => (
              <span key={loc} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-teal-300" />
                {loc}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
