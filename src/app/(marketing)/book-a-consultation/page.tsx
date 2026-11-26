import type { Metadata } from "next";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { company, consultation, whatsappLink, whatsappMessages } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Book a consultation",
  description: `Book a free consultation with ${company.name}. Talk through storage, delivery and pricing for your brand, or message us on WhatsApp. No payment, no obligation.`,
};

export default function BookAConsultationPage() {
  const whatsappHref = whatsappLink(whatsappMessages.consultation);

  return (
    <>
      <PageHero
        crumb="Book a consultation"
        title={consultation.title}
        description={consultation.description}
        image="/images/marketing/support-team.jpg"
      />

      <section className="bg-cream bg-dots py-16 sm:py-24">
        <div className="container-page grid items-start gap-10 lg:grid-cols-[1fr_1.3fr]">
          {/* WhatsApp first, for people who would rather not fill a form. */}
          <div className="flex flex-col gap-6 lg:sticky lg:top-28">
            <div className="rounded-2xl bg-navy p-7 text-white shadow-[0_30px_80px_-30px_rgba(15,42,68,0.6)] sm:p-8">
              <span className="flex size-12 items-center justify-center rounded-full bg-gold text-navy">
                <MessageCircle className="size-6" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-extrabold">{consultation.whatsappTitle}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-mist">{consultation.whatsappBody}</p>
              <Button
                render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
                size="xl"
                className="mt-6 w-full"
              >
                <MessageCircle />
                {consultation.whatsappCta}
              </Button>
              <p className="mt-4 text-center text-sm text-mist">{company.hours}</p>
            </div>

            <ul className="flex flex-col gap-3 rounded-2xl border border-stone bg-white p-6">
              {consultation.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-[15px] text-graphite">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* The form stays for anyone who prefers to write it all down. */}
          <div>
            <ContactForm
              variant="contact"
              title={consultation.formTitle}
              subtitle={consultation.formSubtitle}
            />
          </div>
        </div>
      </section>
    </>
  );
}
