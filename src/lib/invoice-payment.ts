import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";
import { sendQueuedBillingNotices } from "@/lib/billing-email";

// Paystack payments for Standard invoices. References look like
// BIL-<invoice id>-<timestamp>, so the webhook and the return page can both
// tell which invoice a payment is for without a separate lookup table.

export function invoicePaymentReference(invoiceId: string): string {
  return `BIL-${invoiceId}-${Date.now()}`;
}

export function invoiceIdFromReference(reference: string): string | null {
  const match = /^BIL-([0-9a-f-]{36})-\d+$/.exec(reference);
  return match ? match[1] : null;
}

export async function confirmInvoicePayment(
  reference: string,
): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  const invoiceId = invoiceIdFromReference(reference);
  if (!invoiceId) return { ok: false, error: "That payment reference isn't for an invoice." };

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, number, total, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status === "paid") return { ok: true, number: invoice.number };
  if (invoice.status !== "unpaid") return { ok: false, error: `This invoice is ${invoice.status}.` };

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not check the payment." };
  }
  if (verified.status !== "success") return { ok: false, error: "The payment didn't go through." };
  if (verified.amountKobo !== Math.round(Number(invoice.total) * 100)) {
    return { ok: false, error: "The amount paid doesn't match the invoice. Contact us and we'll sort it out." };
  }

  const { error } = await admin.rpc("mark_invoice_paid", {
    p_invoice: invoice.id,
    p_via: "paystack",
    p_ref: reference,
  });
  if (error) return { ok: false, error: error.message };
  await sendQueuedBillingNotices();
  return { ok: true, number: invoice.number };
}
