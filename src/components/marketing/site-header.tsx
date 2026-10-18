"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Mail, MapPin, Menu, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { company, nav } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "./logo";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Contact strip, desktop only. Scrolls away; the main bar sticks. */}
      <div className="hidden bg-navy text-[13px] text-mist lg:block">
        <div className="container-page flex h-10 items-center justify-between">
          <div className="flex items-center gap-6">
            <a href={`tel:${company.phone}`} className="flex items-center gap-2 hover:text-white">
              <Phone className="size-3.5 text-gold" />
              {company.phoneDisplay}
            </a>
            <a href={`mailto:${company.email}`} className="flex items-center gap-2 hover:text-white">
              <Mail className="size-3.5 text-gold" />
              {company.email}
            </a>
            <span className="flex items-center gap-2">
              <MapPin className="size-3.5 text-gold" />
              {company.primaryHub.address}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <Clock className="size-3.5 text-gold" />
              {company.hours}
            </span>
            <a
              href={company.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-semibold text-white hover:text-gold-300"
            >
              <MessageCircle className="size-3.5 text-gold" />
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>

      <header
        className={cn(
          "sticky top-0 z-50 border-b bg-white transition-shadow duration-300",
          scrolled ? "border-stone shadow-[0_8px_30px_-12px_rgba(15,42,68,0.25)]" : "border-transparent",
        )}
      >
        <div className="container-page flex h-[72px] items-center justify-between gap-6">
          <Logo tone="light" />

          <nav className="hidden items-center gap-7 xl:flex" aria-label="Main">
            {nav.links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative py-2 text-[15px] font-semibold transition-colors",
                    active ? "text-navy" : "text-graphite hover:text-navy",
                    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-gold after:transition-transform",
                    active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-5 xl:flex">
            <Link
              href={nav.signIn.href}
              className="text-[15px] font-semibold text-graphite transition-colors hover:text-navy"
            >
              {nav.signIn.label}
            </Link>
            <Button
              render={<Link href={nav.quote.href} />}
              size="xl"
              className="rounded-md px-6"
            >
              {nav.quote.label}
            </Button>
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 text-navy xl:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <Menu className="size-6" />
            </SheetTrigger>
            <SheetContent side="right" className="w-80 border-stone bg-white">
              <SheetHeader>
                <SheetTitle className="text-left text-navy">Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col px-4" aria-label="Mobile">
                {nav.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "border-b border-stone py-3.5 text-[15px] font-semibold transition-colors",
                      isActive(pathname, link.href) ? "text-teal-700" : "text-navy hover:text-teal-700",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-5 flex flex-col gap-2.5 px-4">
                <Button
                  render={<Link href={nav.quote.href} onClick={() => setOpen(false)} />}
                  size="xl"
                  className="w-full"
                >
                  {nav.quote.label}
                </Button>
                <Button
                  render={<Link href={nav.signIn.href} onClick={() => setOpen(false)} />}
                  size="xl"
                  variant="outline"
                  className="w-full"
                >
                  {nav.signIn.label}
                </Button>
              </div>
              <div className="mt-6 flex flex-col gap-2 px-4 text-sm text-graphite">
                <a href={`tel:${company.phone}`} className="flex items-center gap-2">
                  <Phone className="size-4 text-gold" />
                  {company.phoneDisplay}
                </a>
                <a href={company.whatsapp} className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-gold" />
                  Chat on WhatsApp
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </>
  );
}
