import type { Metadata } from "next";
import { company } from "@/lib/site-content";
import { PageHero } from "@/components/marketing/page-hero";
import { EnterpriseCostCalculator } from "@/components/marketing/enterprise-cost-calculator";
import { getEnterpriseDefaults } from "@/lib/enterprise-rates";

export const metadata: Metadata = {
  title: "Enterprise cost calculator",
  description: `Estimate your monthly ${company.name} Enterprise fulfillment cost — storage, pick & pack, intake, insurance and more — before booking a consultation. Prefilled with our standard ranges; override any field with your quoted rate.`,
};

// Public, no login. Rate-card defaults are set by admin and read server-side.
export default async function EnterpriseCalculatorPage() {
  const defaults = await getEnterpriseDefaults();
  return (
    <>
      <PageHero
        crumb="Enterprise calculator"
        title="Estimate your monthly Enterprise cost"
        description="Tell us your volume, adjust the rate card if you already have a quote, and we'll break your estimated monthly cost down line by line. Final rates are confirmed at consultation."
        image="/images/marketing/warehouse-aisle.jpg"
      />
      <section className="bg-cream bg-dots py-16 sm:py-24">
        <div className="container-page">
          <EnterpriseCostCalculator defaults={defaults} />
        </div>
      </section>
    </>
  );
}
