"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { naira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { topUpWallet } from "./actions";
import type { ActionResult } from "@/lib/schemas/wallet";

const PRESETS = [5000, 20000, 50000, 100000];

export function TopUpForm() {
  const [amount, setAmount] = useState("");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await topUpWallet(prev, formData);
      if (result.ok) {
        toast.success("Wallet topped up");
        setAmount("");
      }
      return result;
    },
    null,
  );

  return (
    <form action={formAction}>
      <div className="flex flex-wrap gap-2">
        <input
          name="amount"
          type="number"
          min="100"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount in Naira"
          className="h-10 flex-1 min-w-[180px] rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25"
        />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Adding" : "Add funds"}
        </Button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {PRESETS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(String(v))}
            className="rounded-md border border-gold px-2.5 py-1 text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
          >
            {naira(v)}
          </button>
        ))}
      </div>
      {state && !state.ok ? (
        <p className="mt-2 text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
