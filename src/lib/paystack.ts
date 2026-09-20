import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not start payment with Paystack");
  }

  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
  };
}

export async function verifyTransaction(reference: string): Promise<{
  status: "success" | "failed" | "abandoned" | string;
  amountKobo: number;
  reference: string;
}> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey()}` } },
  );

  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not verify payment with Paystack");
  }

  return {
    status: json.data.status,
    amountKobo: json.data.amount,
    reference: json.data.reference,
  };
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac("sha512", secretKey())
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type OrderPaymentRow = {
  id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  payment_status: "pending" | "paid" | "failed";
};

export async function confirmPayment(
  reference: string,
): Promise<{ ok: true; alreadyProcessed: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("orders")
    .select("id, product_id, quantity, unit_price, total, payment_status")
    .eq("payment_ref", reference);

  if (error) return { ok: false, error: error.message };
  if (!rows || rows.length === 0) {
    return { ok: false, error: "No order found for this payment reference." };
  }

  const orderRows = rows as OrderPaymentRow[];
  if (orderRows.every((r) => r.payment_status !== "pending")) {
    return { ok: true, alreadyProcessed: true };
  }

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Verification failed" };
  }

  if (verified.status !== "success") {
    await admin
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("payment_ref", reference);
    return { ok: false, error: "Payment was not successful." };
  }

  const expectedKobo = Math.round(
    orderRows.reduce((sum, r) => sum + r.total, 0) * 100,
  );
  if (verified.amountKobo !== expectedKobo) {
    await admin
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("payment_ref", reference);
    return { ok: false, error: "Paid amount did not match the order total." };
  }

  for (const row of orderRows) {
    if (!row.product_id) continue;
    await admin.rpc("decrement_stock", {
      p_product_id: row.product_id,
      p_qty: row.quantity,
    });
    // If this returns false the product sold out between checkout and
    // payment confirmation - the order still gets marked paid below since
    // the customer has genuinely paid; the merchant will see stock at 0
    // and needs to follow up. No reservation/holds system in v1.
  }

  await admin
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("payment_ref", reference);

  return { ok: true, alreadyProcessed: false };
}
