import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { company, faq } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { HomeHero } from "@/components/marketing/home-hero";
import { AboutTeaser } from "@/components/marketing/about-teaser";
import { ServicesGrid } from "@/components/marketing/services-grid";
import { WhyUs } from "@/components/marketing/why-us";
import { Steps } from "@/components/marketing/steps";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Testimonials } from "@/components/marketing/testimonials";
import { FaqList, pickFaqs } from "@/components/marketing/faq-list";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <AboutTeaser />
      <ServicesGrid limit={6} />
      <WhyUs />
      <Steps />
      <PricingCards />
      <Testimonials />

      <section className="bg-white py-20 sm:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <SectionHeading
              label={faq.label}
              title={faq.title}
              description="The things merchants usually want to know before they send us their stock."
            />
            <Reveal delay={0.1} className="relative mt-8 hidden aspect-[4/3] overflow-hidden rounded-2xl lg:block">
              <Image
                src="/images/marketing/support-team.jpg"
                alt="The BNP merchant support team at work"
                fill
                sizes="28rem"
                className="object-cover"
              />
              <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-xl bg-white/95 p-4 shadow-lg">
                <MessageCircle className="size-8 shrink-0 text-teal" />
                <div className="text-sm">
                  <div className="font-bold text-navy">Still have questions?</div>
                  <a href={company.whatsapp} className="font-semibold text-teal-700 hover:underline">
                    Chat with us on WhatsApp
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
          <div>
            <FaqList
              items={pickFaqs(["Getting started", "Pricing and payments", "Orders and delivery"], 6)}
            />
            <Button
              render={<Link href="/faq" />}
              size="xl"
              variant="outline"
              className="mt-8 border-navy/20"
            >
              See all questions
              <ArrowRight />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
