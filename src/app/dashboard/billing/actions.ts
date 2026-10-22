"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { initializeTransaction } from "@/lib/paystack";
import { invoicePaymentReference } from "@/lib/invoice-payment";
import { sendQueuedBillingNotices } from "@/lib/billing-email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";
const uuid = z.string().uuid();

function friendly(message: string) {
  return message.replace(/^.*?ERROR:\s*/, "");
}

export async function payInvoiceFromWallet(
  invoiceId: string,
): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  if (!uuid.safeParse(invoiceId).success) return { ok: false, error: "Invoice not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pay_invoice_from_wallet", { p_invoice: invoiceId });
  if (error) return { ok: false, error: friendly(error.message) };
  await sendQueuedBillingNotices();
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { ok: true, number: (data as { number: string }).number };
}

/** Sends the merchant to Paystack to pay an invoice by card or transfer. */
export async function payInvoiceOnline(invoiceId: string): Promise<{ ok: false; error: string }> {
  if (!uuid.safeParse(invoiceId).success) return { ok: false, error: "Invoice not found." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, number, total, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status !== "unpaid") return { ok: false, error: `This invoice is already ${invoice.status}.` };

  const { data: partner } = await supabase.from("partners").select("email").eq("id", user.id).single();

  let url: string;
  try {
    const result = await initializeTransaction({
      email: partner?.email || user.email || "billing@bnpfulfillment.com",
      amountKobo: Math.round(Number(invoice.total) * 100),
      reference: invoicePaymentReference(invoice.id),
      callbackUrl: `${SITE_URL}/dashboard/billing/confirm`,
      metadata: { invoiceId: invoice.id, invoiceNumber: invoice.number },
    });
    url = result.authorizationUrl;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not start payment. Try again." };
  }
  redirect(url);
}

const requestSchema = z.object({
  productId: z.string().uuid(),
  value: z.coerce.number().min(0, "Enter the value per unit").max(1_000_000_000),
  reason: z.string().trim().min(3, "Give a reason for the change").max(500),
});

export async function requestDeclaredValueChange(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_declared_value", {
    p_product: parsed.data.productId,
    p_value: parsed.data.value,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/inventory");
  return { ok: true };
}
