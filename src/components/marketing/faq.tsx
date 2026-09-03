import { faq } from "@/lib/site-content";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

export function Faq() {
  return (
    <section id="faq" className="bg-card py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading label={faq.label} title={faq.title} />

        <Reveal className="mt-12 max-w-3xl">
          <Accordion multiple>
            {faq.items.map((item, i) => (
              <AccordionItem
                key={item.q}
                value={`faq-${i}`}
                className="border-b border-stone"
              >
                <AccordionTrigger className="py-4 text-base font-semibold text-navy hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-graphite">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
