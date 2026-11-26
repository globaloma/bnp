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

export async function setWalletLock(partnerId: string, locked: boolean): Promise<Result> {
  if (!uuid.safeParse(partnerId).success) return { ok: false, error: "Merchant not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_wallet_lock", { p_partner: partnerId, p_locked: locked });
  if (error) return { ok: false, error: friendly(error.message) };
  return done(locked ? "Orders blocked" : "Block lifted: they can create orders again");
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

export async function setStandardRestock(partnerId: string, enabled: boolean): Promise<Result> {
  if (!uuid.safeParse(partnerId).success) return { ok: false, error: "Merchant not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_standard_restock", {
    p_partner: partnerId,
    p_enabled: enabled,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return done(enabled ? "Restock fee switched on" : "Restock fee switched off");
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

// --- Enterprise Plan v2 (migration 0038) --------------------------------------

/** Save a merchant's Enterprise rate card. `rates` is a plain object of rate fields. */
export async function setEnterpriseRates(partnerId: string, rates: Record<string, unknown>): Promise<Result> {
  if (!uuid.safeParse(partnerId).success) return { ok: false, error: "Merchant not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_enterprise_rates", { p_partner: partnerId, p: rates });
  if (error) return { ok: false, error: friendly(error.message) };
  return done("Rate card saved");
}

/** Save the global Enterprise default rates (seed new cards + prefill the public calculator). */
export async function setEnterpriseDefaults(defaults: Record<string, unknown>): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_enterprise_defaults", { p: defaults });
  if (error) return { ok: false, error: friendly(error.message) };
  return done("Defaults saved");
}

/** Build (or fetch) the pending invoice for an Enterprise merchant for a month. */
export async function buildEnterpriseInvoice(partnerId: string, period: string): Promise<Result> {
  if (!uuid.safeParse(partnerId).success) return { ok: false, error: "Merchant not found." };
  if (!/^\d{4}-\d{2}-01$/.test(period)) return { ok: false, error: "Pick a month." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_build_enterprise_invoice", { p_partner: partnerId, p_period: period });
  if (error) return { ok: false, error: friendly(error.message) };
  return done("Draft invoice ready");
}

/** Add a new line (lineId null) or edit an existing one on a pending invoice. */
export async function upsertInvoiceLine(params: {
  lineId: string | null;
  invoiceId: string;
  kind: string;
  label: string;
  quantity: number | null;
  unitRate: number | null;
  amount: number;
}): Promise<Result> {
  if (params.lineId && !uuid.safeParse(params.lineId).success) return { ok: false, error: "Line not found." };
  if (!uuid.safeParse(params.invoiceId).success) return { ok: false, error: "Invoice not found." };
  if (!params.label.trim()) return { ok: false, error: "Give the line a label." };
  if (!Number.isFinite(params.amount)) return { ok: false, error: "Enter an amount." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_upsert_invoice_line", {
    p_line: params.lineId,
    p_invoice: params.invoiceId,
    p_kind: params.kind.slice(0, 40) || "other",
    p_label: params.label.slice(0, 160),
    p_quantity: params.quantity,
    p_unit_rate: params.unitRate,
    p_amount: params.amount,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return done("Line saved");
}

export async function removeInvoiceLine(lineId: string): Promise<Result> {
  if (!uuid.safeParse(lineId).success) return { ok: false, error: "Line not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_invoice_line", { p_line: lineId });
  if (error) return { ok: false, error: friendly(error.message) };
  return done("Line removed");
}

export async function finalizeInvoice(invoiceId: string): Promise<Result> {
  if (!uuid.safeParse(invoiceId).success) return { ok: false, error: "Invoice not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_finalize_invoice", { p_invoice: invoiceId });
  if (error) return { ok: false, error: friendly(error.message) };
  return done("Invoice finalised and sent to the merchant");
}
