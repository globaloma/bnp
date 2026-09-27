import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { naira } from "@/lib/format";
import { getFulfillmentCenterEmails, sendAlertEmail } from "@/lib/notifications";

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
  partner_id: string;
  order_ref: string;
  customer_name: string;
  product_name: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  payment_status: "pending" | "paid" | "failed";
};

function orderItemRows(orderRows: OrderPaymentRow[]): string {
  return orderRows
    .map(
      (r) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#455568;font-size:13px;">${r.product_name} × ${r.quantity}</td><td style="padding:6px 0;color:#0f2a44;font-size:13px;font-weight:600;text-align:right;">${naira(r.total)}</td></tr>`,
    )
    .join("");
}

async function sendNewOrderAlert(orderRows: OrderPaymentRow[]) {
  const partnerId = orderRows[0]?.partner_id;
  if (!partnerId) return;

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("business_name, email")
    .eq("id", partnerId)
    .maybeSingle();

  const orderRef = orderRows[0].order_ref;
  const customerName = orderRows[0].customer_name;
  const grandTotal = orderRows.reduce((sum, r) => sum + r.total, 0);
  const itemRows = orderItemRows(orderRows);

  if (partner?.email) {
    await sendAlertEmail({
      to: [partner.email],
      subject: `New order ${orderRef} - ${naira(grandTotal)}`,
      html: `
        <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
          <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">You've got a new order</h2>
          <p style="color:#455568;font-size:13px;margin:0 0 16px;">${customerName} just paid for order ${orderRef} on your storefront.</p>
          <table style="border-collapse:collapse;width:100%;">${itemRows}</table>
          <p style="color:#0f2a44;font-size:14px;font-weight:700;margin:12px 0 0;">Total: ${naira(grandTotal)}</p>
        </div>
      `,
    });
  }

  const fcEmails = await getFulfillmentCenterEmails();
  if (fcEmails.length > 0) {
    await sendAlertEmail({
      to: fcEmails,
      subject: `New order to fulfill: ${orderRef} - ${naira(grandTotal)}`,
      html: `
        <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
          <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">New order ready for fulfillment</h2>
          <p style="color:#455568;font-size:13px;margin:0 0 16px;">${partner?.business_name ?? "A merchant"} has a new paid order (${orderRef}) for ${customerName}.</p>
          <table style="border-collapse:collapse;width:100%;">${itemRows}</table>
          <p style="color:#0f2a44;font-size:14px;font-weight:700;margin:12px 0 0;">Total: ${naira(grandTotal)}</p>
        </div>
      `,
    });
  }
}

export async function confirmPayment(
  reference: string,
): Promise<{ ok: true; alreadyProcessed: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("orders")
    .select(
      "id, partner_id, order_ref, customer_name, product_name, product_id, quantity, unit_price, total, payment_status",
    )
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

  await sendNewOrderAlert(orderRows);

  return { ok: true, alreadyProcessed: false };
}

export async function listBanks(): Promise<{ name: string; code: string }[]> {
  const res = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });

  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not load the list of banks");
  }

  return (json.data as { name: string; code: string }[]).map((b) => ({
    name: b.name,
    code: b.code,
  }));
}

export async function resolveAccount(
  accountNumber: string,
  bankCode: string,
): Promise<{ accountName: string }> {
  const res = await fetch(
    `${PAYSTACK_BASE}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    { headers: { Authorization: `Bearer ${secretKey()}` } },
  );

  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not verify that account number");
  }

  return { accountName: json.data.account_name };
}

export async function createTransferRecipient(params: {
  accountName: string;
  accountNumber: string;
  bankCode: string;
}): Promise<{ recipientCode: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "nuban",
      name: params.accountName,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: "NGN",
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not save that bank account with Paystack");
  }

  return { recipientCode: json.data.recipient_code };
}

export async function initiateTransfer(params: {
  amountKobo: number;
  recipientCode: string;
  reference: string;
  reason?: string;
}): Promise<{ transferCode: string; status: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "balance",
      amount: params.amountKobo,
      recipient: params.recipientCode,
      reference: params.reference,
      reason: params.reason,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not start the transfer with Paystack");
  }

  return { transferCode: json.data.transfer_code, status: json.data.status };
}

export async function confirmWalletTopup(
  reference: string,
): Promise<{ ok: true; alreadyProcessed: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: topup, error } = await admin
    .from("wallet_topups")
    .select("id, partner_id, amount, status")
    .eq("reference", reference)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!topup) return { ok: false, error: "No top-up found for this payment reference." };
  if (topup.status !== "pending") {
    return { ok: true, alreadyProcessed: true };
  }

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Verification failed" };
  }

  if (verified.status !== "success") {
    await admin.from("wallet_topups").update({ status: "failed" }).eq("reference", reference);
    return { ok: false, error: "Payment was not successful." };
  }

  const expectedKobo = Math.round(topup.amount * 100);
  if (verified.amountKobo !== expectedKobo) {
    await admin.from("wallet_topups").update({ status: "failed" }).eq("reference", reference);
    return { ok: false, error: "Paid amount did not match the top-up amount." };
  }

  await admin.rpc("wallet_credit", {
    p_partner_id: topup.partner_id,
    p_amount: topup.amount,
    p_type: "Top-up",
    p_note: "Wallet top-up via Paystack",
  });

  await admin.from("wallet_topups").update({ status: "paid" }).eq("reference", reference);

  return { ok: true, alreadyProcessed: false };
}

export async function confirmTransfer(
  reference: string,
  outcome: "success" | "failed" | "reversed",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: withdrawal, error } = await admin
    .from("wallet_withdrawals")
    .select("id, partner_id, amount, status")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!withdrawal) return { ok: false, error: "No withdrawal found for this transfer reference." };
  if (withdrawal.status === "success" || withdrawal.status === "failed") {
    return { ok: true };
  }

  if (outcome === "success") {
    await admin
      .from("wallet_withdrawals")
      .update({ status: "success", updated_at: new Date().toISOString() })
      .eq("paystack_reference", reference);
    return { ok: true };
  }

  // Failed or reversed - refund the reserved balance back. Logged as a
  // Top-up (money coming back in), not a Deduction, so the transaction
  // history doesn't show a positive amount labeled "Deduction".
  await admin.rpc("wallet_credit", {
    p_partner_id: withdrawal.partner_id,
    p_amount: withdrawal.amount,
    p_type: "Top-up",
    p_note: `Withdrawal ${outcome}, refunded`,
  });

  await admin
    .from("wallet_withdrawals")
    .update({
      status: "failed",
      failure_reason: outcome,
      updated_at: new Date().toISOString(),
    })
    .eq("paystack_reference", reference);

  return { ok: true };
}
