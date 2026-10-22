import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { company, pricing } from "@/lib/site-content";
import { PageHero } from "@/components/marketing/page-hero";
import { QuoteCalculator } from "@/components/marketing/quote-calculator";
import { GuaranteeBanner } from "@/components/marketing/guarantee";

export const metadata: Metadata = {
  title: "Get a quote",
  description: `Estimate what storing your goods and fulfilling your orders with ${company.name} would cost each month, on the Standard or Enterprise plan, in under a minute.`,
};

export default function GetAQuotePage() {
  return (
    <>
      <PageHero
        crumb="Get a quote"
        title="What would BNP cost for your brand?"
        description="Pick a plan and move the sliders to match your stock and sales. Your estimate updates instantly, and our team can confirm it for you."
        image="/images/marketing/boxes-trolley.jpg"
      />

      <section className="bg-cream bg-dots py-16 sm:py-24">
        <div className="container-page">
          <ul className="mb-6 flex flex-wrap gap-x-8 gap-y-3 text-[15px] font-semibold text-navy">
            {pricing.plans.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-teal" />
                {p.name}: {p.fee} {p.feeUnit}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-teal" />
              Storage: ₦10,000 per m² per month
            </li>
          </ul>
          <GuaranteeBanner className="mb-10" />
          <QuoteCalculator />
        </div>
      </section>
    </>
  );
}
