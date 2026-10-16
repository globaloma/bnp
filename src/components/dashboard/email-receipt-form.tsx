"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { jsPDF } from "jspdf";
import { emailReceipt } from "@/app/actions/receipt-email";
import { Button } from "@/components/ui/button";

/**
 * "Send to [email] [Send]" for emailing the receipt PDF as an attachment.
 * Prefilled with the customer's email when the order has one.
 */
export function EmailReceiptForm({
  partnerId,
  orderRef,
  defaultEmail,
  makePdf,
  onDone,
}: {
  partnerId: string;
  orderRef: string;
  defaultEmail: string | null;
  makePdf: () => Promise<jsPDF> | jsPDF;
  onDone: () => void;
}) {
  const [to, setTo] = useState(defaultEmail ?? "");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const doc = await makePdf();
      // "data:application/pdf;filename=generated.pdf;base64,AAAA" -> "AAAA"
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const result = await emailReceipt({ partnerId, orderRef, to, pdfBase64 });
      if (result.ok) {
        toast.success(`Receipt emailed to ${result.to}`);
        onDone();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the receipt");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className="flex w-full flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`receipt-email-${orderRef}`}>
        Customer email
      </label>
      <input
        id={`receipt-email-${orderRef}`}
        type="email"
        required
        autoFocus
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="customer@example.com"
        className="h-8 min-w-0 flex-1 rounded-md border border-stone bg-white px-2.5 text-xs text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25"
      />
      <Button type="submit" size="sm" disabled={sending}>
        {sending ? "Sending" : "Send PDF"}
      </Button>
      <button
        type="button"
        onClick={onDone}
        className="text-xs font-semibold text-graphite hover:text-navy"
      >
        Cancel
      </button>
    </form>
  );
}
