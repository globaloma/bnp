import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { company, ctaBand, footer, nav } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-navy">
      {/* Call to action that overlaps the top of the footer. */}
      <div className="container-page relative z-10 -mb-px pt-16 sm:pt-20">
        <div className="relative overflow-hidden rounded-2xl bg-gold px-6 py-10 sm:px-12 sm:py-12">
          <Image
            src="/images/marketing/packing-tape.jpg"
            alt=""
            fill
            sizes="(min-width: 1024px) 40rem, 100vw"
            className="object-cover opacity-15 mix-blend-multiply"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight text-navy sm:text-3xl">
                {ctaBand.title}
              </h2>
              <p className="mt-2 text-base text-navy/80">{ctaBand.body}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                render={<Link href={nav.quote.href} />}
                size="xl"
                className="bg-navy text-white hover:bg-navy-600"
              >
                {nav.quote.label}
                <ArrowRight />
              </Button>
              <Button
                render={<Link href={nav.signUp.href} />}
                size="xl"
                variant="outline"
                className="border-navy/30 bg-transparent text-navy hover:bg-navy/10"
              >
                {nav.signUp.label}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-dots-light">
        <div className="container-page grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-mist">{footer.description}</p>
            <a
              href={company.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-gold hover:text-gold-300"
            >
              <MessageCircle className="size-4" />
              Chat with us on WhatsApp
            </a>
          </div>

          {footer.columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-display text-base font-bold text-white">{column.title}</h3>
              <span className="mt-2 block h-0.5 w-8 rounded-full bg-gold" aria-hidden />
              <ul className="mt-5 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-mist transition-colors hover:text-gold-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="font-display text-base font-bold text-white">Get in touch</h3>
            <span className="mt-2 block h-0.5 w-8 rounded-full bg-gold" aria-hidden />
            <ul className="mt-5 flex flex-col gap-4 text-sm text-mist">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                <span>
                  BoxNPick, Suite 207, Alba Plaza
                  <br />
                  Jabi, Abuja, Nigeria
                </span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-gold" />
                <a href={`tel:${company.phone}`} className="hover:text-gold-300">
                  {company.phoneDisplay}
                </a>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-gold" />
                <a href={`mailto:${company.email}`} className="break-all hover:text-gold-300">
                  {company.email}
                </a>
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-gold" />
                {company.hours}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="container-page flex flex-col gap-3 py-6 text-xs text-mist sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {company.legalName}. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/terms" className="hover:text-gold-300">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-gold-300">
                Privacy
              </Link>
              <Link href={nav.signIn.href} className="hover:text-gold-300">
                Merchant sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
