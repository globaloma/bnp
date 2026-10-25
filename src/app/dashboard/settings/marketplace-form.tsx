"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";
import { setMarketplaceListing } from "./marketplace-actions";

export function MarketplaceForm({ enabled, shopUrl }: { enabled: boolean; shopUrl: string }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    start(async () => {
      const result = await setMarketplaceListing(next);
      if (result.ok) {
        setOn(next);
        toast.success(next ? "Your products are on BNP Shop" : "Your products are hidden from BNP Shop");
      } else toast.error(result.error);
    });
  }

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-navy">BNP Shop</h2>
          <p className="mt-1 text-sm text-graphite">
            Your published products also appear on{" "}
            <a href={shopUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 hover:underline">
              BNP Shop
            </a>
            , our marketplace for customers. We pack and deliver those orders from your stock, and the sale goes into your
            wallet once the order is delivered.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Show my products on BNP Shop"
          disabled={pending}
          onClick={toggle}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
            on ? "bg-teal" : "bg-stone",
          )}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[1.375rem]" : "left-0.5")} />
        </button>
      </div>
    </Panel>
  );
}
