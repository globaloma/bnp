"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setChargesVat } from "@/app/dashboard/inventory/actions";

export function VatToggle({ initialChargesVat }: { initialChargesVat: boolean }) {
  const [chargesVat, setLocalChargesVat] = useState(initialChargesVat);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !chargesVat;
    startTransition(async () => {
      const result = await setChargesVat(next);
      if (result.ok) {
        setLocalChargesVat(next);
        toast.success(next ? "VAT will be charged on your orders" : "VAT is now off for your orders");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
        chargesVat
          ? "border-teal/40 bg-teal/10 text-teal-700"
          : "border-stone bg-white text-graphite hover:border-teal/40",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-7 items-center rounded-full p-0.5 transition-colors",
          chargesVat ? "justify-end bg-teal" : "justify-start bg-stone",
        )}
      >
        <span className="size-3 rounded-full bg-white shadow" />
      </span>
      {chargesVat ? "Charging VAT" : "VAT off"}
    </button>
  );
}
