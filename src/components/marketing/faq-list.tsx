import { faq } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FaqItem = { q: string; a: string };

/** Picks a few questions across the groups, for the homepage and pricing page. */
export function pickFaqs(groups: string[], count: number): FaqItem[] {
  const all: { title: string; items: readonly FaqItem[] }[] = [...faq.groups];
  return all
    .filter((g) => groups.includes(g.title))
    .flatMap((g) => [...g.items])
    .slice(0, count);
}

export function FaqList({ items, className }: { items: readonly FaqItem[]; className?: string }) {
  return (
    <Accordion className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => (
        <AccordionItem
          key={item.q}
          value={item.q}
          className="rounded-xl border border-stone bg-white px-5 transition-shadow not-last:border-b data-open:shadow-[0_16px_40px_-24px_rgba(15,42,68,0.35)]"
        >
          <AccordionTrigger className="py-4.5 font-display text-base font-bold text-navy hover:no-underline **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-gold">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="pb-5 text-[15px] leading-relaxed text-graphite">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
