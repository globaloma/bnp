import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { company, contact } from "@/lib/site-content";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact us",
  description: `Talk to ${company.name} about storing your stock and fulfilling your orders. Call, WhatsApp, email or visit our hub in Jabi, Abuja.`,
};

const channels = [
  { icon: Phone, label: "Call us", value: company.phoneDisplay, href: `tel:${company.phone}` },
  { icon: MessageCircle, label: "WhatsApp", value: "Chat with our team", href: company.whatsapp },
  { icon: Mail, label: "Email", value: company.email, href: `mailto:${company.email}` },
  {
    icon: MapPin,
    label: "Visit our hub",
    value: `BoxNPick, ${company.primaryHub.address}`,
    href: null,
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <PageHero
        crumb="Contact"
        title={contact.title}
        description={contact.description}
        image="/images/marketing/merchant-laptop.jpg"
      />

      <section className="py-16 sm:py-24">
        <div className="container-page">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {channels.map((c, i) => {
              const body = (
                <>
                  <span className="flex size-12 items-center justify-center rounded-xl bg-gold/15 text-gold transition-colors group-hover:bg-gold group-hover:text-navy">
                    <c.icon className="size-6" />
                  </span>
                  <span className="mt-5 block text-sm font-semibold text-graphite">{c.label}</span>
                  <span className="mt-1 block font-display text-base font-bold break-words text-navy">
                    {c.value}
                  </span>
                </>
              );
              return (
                <Reveal key={c.label} delay={i * 0.06} className="h-full">
                  {c.href ? (
                    <a
                      href={c.href}
                      className="group block h-full rounded-2xl border border-stone bg-white p-6 transition-shadow hover:shadow-[0_24px_60px_-28px_rgba(15,42,68,0.4)]"
                    >
                      {body}
                    </a>
                  ) : (
                    <div className="group h-full rounded-2xl border border-stone bg-white p-6">{body}</div>
                  )}
                </Reveal>
              );
            })}
          </div>

          <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.35fr] lg:items-start">
            <div>
              <SectionHeading
                label={contact.label}
                title="We'd love to hear about your brand."
                description="Tell us what you sell and where your customers are. We reply within 48 hours, usually sooner."
              />
              <Reveal
                delay={0.1}
                className="mt-8 flex items-center gap-3 rounded-xl border border-stone bg-white p-4 text-[15px] text-graphite"
              >
                <Clock className="size-5 shrink-0 text-teal" />
                {company.hours}
              </Reveal>
              <Reveal delay={0.15} className="mt-6 overflow-hidden rounded-2xl border border-stone">
                <iframe
                  title="Map of our hub at Alba Plaza, Jabi, Abuja"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(contact.mapQuery)}&z=14&output=embed`}
                  className="h-72 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </Reveal>
            </div>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
