"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { naira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { requestWithdrawal } from "./actions";
import type { ActionResult } from "@/lib/schemas/wallet";

export function WithdrawForm({
  available,
  bankAccountName,
  bankAccountNumber,
}: {
  available: number;
  bankAccountName: string;
  bankAccountNumber: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await requestWithdrawal(prev, formData);
      if (result.ok) {
        toast.success("Withdrawal started");
      }
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="rounded-md border border-stone bg-white px-3 py-2 text-sm">
        <div className="font-medium text-navy">{bankAccountName}</div>
        <div className="text-xs text-mist">Account ending {bankAccountNumber.slice(-4)}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          name="amount"
          type="number"
          min="100"
          max={available}
          step="1"
          placeholder="Enter amount in Naira"
          className="h-10 flex-1 min-w-[180px] rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25"
        />
        <Button type="submit" size="lg" disabled={pending || available <= 0}>
          {pending ? "Processing" : "Withdraw"}
        </Button>
      </div>
      <p className="text-xs text-mist">
        Up to {naira(available)} available right now, after your reserved buffer.
      </p>
      {state && !state.ok ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
