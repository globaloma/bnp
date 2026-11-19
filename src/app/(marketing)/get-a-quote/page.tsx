import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { company } from "@/lib/site-content";
import { PageHero } from "@/components/marketing/page-hero";
import { QuoteCalculator } from "@/components/marketing/quote-calculator";
import { GuaranteeBanner } from "@/components/marketing/guarantee";

export const metadata: Metadata = {
  title: "Get a quote — Standard plan",
  description: `Estimate what storing your goods and fulfilling your orders with ${company.name} would cost each month on the Standard plan, in under a minute. High-volume or international? Try the Enterprise calculator.`,
};

export default function GetAQuotePage() {
  return (
    <>
      <PageHero
        crumb="Get a quote"
        title="What would the Standard plan cost for your brand?"
        description="Move the sliders to match your stock and sales. Your estimate updates instantly, and our team can confirm it for you."
        image="/images/marketing/boxes-trolley.jpg"
      />

      <section className="bg-cream bg-dots py-16 sm:py-24">
        <div className="container-page">
          <ul className="mb-6 flex flex-wrap gap-x-8 gap-y-3 text-[15px] font-semibold text-navy">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-teal" />
              Standard: 7% of monthly sales, all-inclusive
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-teal" />
              Storage: ₦10,000 per m² per month
            </li>
          </ul>
          <div className="mb-8 flex flex-wrap items-center gap-2 rounded-xl border border-stone bg-white px-5 py-4 text-sm text-graphite">
            <span>
              This calculator is for the <strong className="text-navy">Standard</strong> plan. Selling at high volume or
              into Nigeria from abroad?
            </span>
            <Link
              href="/enterprise-calculator"
              className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
            >
              Try the Enterprise calculator <ArrowRight className="size-4" />
            </Link>
          </div>
          <GuaranteeBanner className="mb-10" />
          <QuoteCalculator />
        </div>
      </section>
    </>
  );
}
