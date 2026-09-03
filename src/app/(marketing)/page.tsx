import { Hero } from "@/components/marketing/hero";
import { Services } from "@/components/marketing/services";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Audience } from "@/components/marketing/audience";
import { Hub } from "@/components/marketing/hub";
import { Pricing } from "@/components/marketing/pricing";
import { Testimonials } from "@/components/marketing/testimonials";
import { Apply } from "@/components/marketing/apply";
import { Faq } from "@/components/marketing/faq";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Services />
      <HowItWorks />
      <Audience />
      <Hub />
      <Pricing />
      <Testimonials />
      <Apply />
      <Faq />
    </>
  );
}
