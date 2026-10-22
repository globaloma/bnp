"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendQueuedBillingNotices } from "@/lib/billing-email";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const uuid = z.string().uuid();
const friendly = (m: string) => m.replace(/^.*?ERROR:\s*/, "");

async function done(message?: string): Promise<Result> {
  await sendQueuedBillingNotices();
  revalidatePath("/admin/billing");
  return { ok: true, message };
}

export async function runBilling(period: string): Promise<Result> {
  if (!/^\d{4}-\d{2}-01$/.test(period)) return { ok: false, error: "Pick a month." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_run_billing", { p_period: period });
  if (error) return { ok: false, error: friendly(error.message) };
  const r = data as { skipped?: string; invoices?: number; charges?: number; locked?: number };
  if (r.skipped) return done(r.skipped);
  return done(
    `${r.invoices ?? 0} invoice${r.invoices === 1 ? "" : "s"} issued, ${r.charges ?? 0} wallet charge${
      r.charges === 1 ? "" : "s"
    }, ${r.locked ?? 0} account${r.locked === 1 ? "" : "s"} paused.`,
  );
}

export async function setEnterpriseTerms(partnerId: string, minimum: number, manager: string): Promise<Result> {
  if (!uuid.safeParse(partnerId).success) return { ok: false, error: "Merchant not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_enterprise_terms", {
    p_partner: partnerId,
    p_minimum: minimum,
    p_manager: manager.slice(0, 200),
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return done();
}

export async function invoiceAction(invoiceId: string, action: "paid" | "void", note: string): Promise<Result> {
  if (!uuid.safeParse(invoiceId).success) return { ok: false, error: "Invoice not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_invoice_action", {
    p_invoice: invoiceId,
    p_action: action,
    p_note: note.slice(0, 300) || null,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return done();
}

export async function decideDeclaredValue(requestId: string, approve: boolean, notes: string): Promise<Result> {
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "Request not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_decide_declared_value", {
    p_request: requestId,
    p_approve: approve,
    p_notes: notes.slice(0, 500) || null,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return done();
}

export async function adjustWallet(partnerId: string, amount: number, reason: string): Promise<Result> {
  if (!uuid.safeParse(partnerId).success) return { ok: false, error: "Pick a merchant." };
  if (!Number.isFinite(amount) || amount === 0) return { ok: false, error: "Enter an amount." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_wallet_adjust", {
    p_partner: partnerId,
    p_amount: amount,
    p_reason: reason.slice(0, 300),
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return done();
}
