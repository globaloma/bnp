"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  topUpSchema,
  bankAccountSchema,
  withdrawSchema,
  type ActionResult,
} from "@/lib/schemas/wallet";
import {
  initializeTransaction,
  resolveAccount,
  createTransferRecipient,
  initiateTransfer,
} from "@/lib/paystack";
import { naira } from "@/lib/format";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export async function startWalletTopup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = topUpSchema.safeParse({ amount: formData.get("amount") });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter a valid amount.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { data: partner } = await supabase
    .from("partners")
    .select("email")
    .eq("id", user.id)
    .single();

  const admin = createAdminClient();
  const reference = `WTU-${crypto.randomUUID()}`;

  const { error: insertError } = await admin.from("wallet_topups").insert({
    partner_id: user.id,
    amount: parsed.data.amount,
    reference,
    status: "pending",
  });

  if (insertError) return { ok: false, error: insertError.message };

  let authorizationUrl: string;
  try {
    const result = await initializeTransaction({
      email: partner?.email || user.email || "guest@bnpfulfillment.com",
      amountKobo: Math.round(parsed.data.amount * 100),
      reference,
      callbackUrl: `${SITE_URL}/dashboard/wallet/confirm`,
    });
    authorizationUrl = result.authorizationUrl;
  } catch (err) {
    await admin.from("wallet_topups").update({ status: "failed" }).eq("reference", reference);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start payment. Please try again.",
    };
  }

  redirect(authorizationUrl);
}

export async function resolveBankAccount(
  bankCode: string,
  accountNumber: string,
): Promise<{ ok: true; accountName: string } | { ok: false; error: string }> {
  const parsed = bankAccountSchema.safeParse({ bankCode, accountNumber });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid bank and account number." };
  }

  try {
    const { accountName } = await resolveAccount(parsed.data.accountNumber, parsed.data.bankCode);
    return { ok: true, accountName };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not verify that account.",
    };
  }
}

export async function saveBankAccount(
  bankCode: string,
  accountNumber: string,
  accountName: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  let recipientCode: string;
  try {
    const result = await createTransferRecipient({ accountName, accountNumber, bankCode });
    recipientCode = result.recipientCode;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save that bank account.",
    };
  }

  const { error } = await supabase
    .from("partners")
    .update({
      bank_code: bankCode,
      bank_account_number: accountNumber,
      bank_account_name: accountName,
      paystack_recipient_code: recipientCode,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/wallet");
  return { ok: true };
}

export async function requestWithdrawal(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = withdrawSchema.safeParse({ amount: formData.get("amount") });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter a valid amount.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { data: partner } = await supabase
    .from("partners")
    .select(
      "wallet_balance, wallet_buffer, bank_code, bank_account_number, bank_account_name, paystack_recipient_code",
    )
    .eq("id", user.id)
    .single();

  if (!partner?.paystack_recipient_code) {
    return { ok: false, error: "Add a bank account before withdrawing." };
  }

  const available = partner.wallet_balance - partner.wallet_buffer;
  if (parsed.data.amount > available) {
    return { ok: false, error: `You can withdraw up to ${naira(available)} right now.` };
  }

  // Reserve the funds immediately, before Paystack is even contacted - the
  // RPC also independently re-checks the buffer server-side.
  const { error: debitError } = await supabase.rpc("wallet_debit", {
    p_amount: parsed.data.amount,
    p_note: "Withdrawal requested",
  });
  if (debitError) return { ok: false, error: debitError.message };

  const admin = createAdminClient();
  const reference = `WWD-${crypto.randomUUID()}`;

  const { error: insertError } = await admin.from("wallet_withdrawals").insert({
    partner_id: user.id,
    amount: parsed.data.amount,
    bank_account_name: partner.bank_account_name,
    bank_account_number: partner.bank_account_number,
    bank_code: partner.bank_code,
    status: "pending",
    paystack_reference: reference,
  });

  if (insertError) {
    await admin.rpc("wallet_credit", {
      p_partner_id: user.id,
      p_amount: parsed.data.amount,
      p_type: "Top-up",
      p_note: "Withdrawal could not be recorded, refunded",
    });
    return { ok: false, error: insertError.message };
  }

  try {
    const result = await initiateTransfer({
      amountKobo: Math.round(parsed.data.amount * 100),
      recipientCode: partner.paystack_recipient_code,
      reference,
      reason: "Wallet withdrawal",
    });

    await admin
      .from("wallet_withdrawals")
      .update({
        status: result.status === "success" ? "success" : "processing",
        paystack_transfer_code: result.transferCode,
        updated_at: new Date().toISOString(),
      })
      .eq("paystack_reference", reference);
  } catch (err) {
    // The transfer never started with Paystack at all - refund right away
    // rather than leaving the merchant's balance short with nothing to
    // show for it.
    await admin.rpc("wallet_credit", {
      p_partner_id: user.id,
      p_amount: parsed.data.amount,
      p_type: "Top-up",
      p_note: "Withdrawal failed to start, refunded",
    });
    await admin
      .from("wallet_withdrawals")
      .update({
        status: "failed",
        failure_reason: err instanceof Error ? err.message : "unknown",
        updated_at: new Date().toISOString(),
      })
      .eq("paystack_reference", reference);
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not start the withdrawal. Please try again.",
    };
  }

  revalidatePath("/dashboard/wallet");
  return { ok: true };
}
