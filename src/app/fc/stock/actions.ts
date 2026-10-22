"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { friendlyError } from "@/lib/deliveries";
import { sendQueuedLowStockAlerts } from "@/lib/low-stock-email";
import type { OrderStatus, ScanResult, WarehouseLocation } from "@/types/db";

// Returns, cycle counts and supervisor approvals (migration 0025).

const uuid = z.string().uuid();

function fail(message: string): ScanResult {
  return { ok: false, tone: "error", message };
}

function touch() {
  revalidatePath("/fc/approvals");
  revalidatePath("/fc/returns");
  revalidatePath("/fc/counts");
  revalidatePath("/fc/putaway");
  revalidatePath("/fc/inventory");
  revalidatePath("/fc/stock-log");
}

// ---------------------------------------------------------------------------
// Returns
// ---------------------------------------------------------------------------

export type ReturnLine = {
  order_id: string;
  partner_id: string;
  order_ref: string;
  merchant: string;
  customer: string;
  product_id: string | null;
  product: string;
  barcode: string | null;
  status: OrderStatus;
  quantity: number;
  returned: number;
  damaged: number;
};

export async function lookupReturn(code: string): Promise<{ ok: true; lines: ReturnLine[] } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("return_lookup", { p_code: code.slice(0, 80) });
  if (error) return { ok: false, message: friendlyError(error.message) };
  const lines = (data ?? []) as ReturnLine[];
  if (lines.length === 0) {
    return { ok: false, message: `No dispatched order found for ${code.trim().toUpperCase()}.` };
  }
  return { ok: true, lines };
}

export async function returnScan(
  partnerId: string,
  orderRef: string,
  code: string,
  damaged: boolean,
  qty: number,
): Promise<ScanResult> {
  if (!uuid.safeParse(partnerId).success) return fail("Scan the package label first.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("return_scan", {
    p_partner: partnerId,
    p_order_ref: orderRef.slice(0, 40),
    p_code: code.slice(0, 80),
    p_damaged: damaged,
    p_qty: Math.floor(qty),
  });
  if (error) return fail(friendlyError(error.message));
  touch();
  revalidatePath("/fc/orders");
  return data as ScanResult;
}

// ---------------------------------------------------------------------------
// Cycle counts
// ---------------------------------------------------------------------------

export type CountBin = {
  id: string;
  code: string;
  product: { id: string; label: string; barcode: string | null } | null;
  pending: boolean;
};

export async function findCountBin(
  code: string,
  where: WarehouseLocation,
): Promise<{ ok: true; bin: CountBin } | { ok: false; message: string }> {
  const supabase = await createClient();
  const value = code.trim().toUpperCase().slice(0, 60);
  const { data: bin } = await supabase
    .from("bins")
    .select("id, code, location, stock:bin_stock(product:products(id, name, variant, barcode))")
    .eq("barcode", value)
    .maybeSingle();
  if (!bin) return { ok: false, message: `Unknown bin label: ${value}` };
  if (bin.location !== where) {
    return { ok: false, message: `Bin ${bin.code} is in the ${bin.location} warehouse, not ${where}.` };
  }
  const { count } = await supabase
    .from("stock_adjustments")
    .select("id", { count: "exact", head: true })
    .eq("bin_id", bin.id)
    .eq("status", "pending");

  type Stock = { product: { id: string; name: string; variant: string | null; barcode: string | null } | null };
  const raw = (bin as unknown as { stock: Stock | Stock[] | null }).stock;
  const product = (Array.isArray(raw) ? raw[0] : raw)?.product ?? null;
  return {
    ok: true,
    bin: {
      id: bin.id,
      code: bin.code,
      product: product
        ? {
            id: product.id,
            label: product.variant ? `${product.name} (${product.variant})` : product.name,
            barcode: product.barcode,
          }
        : null,
      pending: (count ?? 0) > 0,
    },
  };
}

export async function submitCount(binId: string, counted: number, note: string): Promise<ScanResult> {
  if (!uuid.safeParse(binId).success) return fail("Scan a bin first.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_bin_count", {
    p_bin: binId,
    p_counted: Math.floor(counted),
    p_note: note.slice(0, 500) || null,
  });
  if (error) return fail(friendlyError(error.message));
  touch();
  return data as ScanResult;
}

/** Checks that a scanned item is the product a bin should hold. */
export async function checkCountItem(code: string, productId: string): Promise<boolean> {
  if (!uuid.safeParse(productId).success) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("barcode, retail_barcode, sku")
    .eq("id", productId)
    .maybeSingle();
  if (!data) return false;
  const value = code.trim();
  return (
    value.toUpperCase() === data.barcode ||
    (data.retail_barcode !== null && value === data.retail_barcode) ||
    (data.sku !== null && value.toUpperCase() === data.sku.toUpperCase())
  );
}

// ---------------------------------------------------------------------------
// Adjustments and approvals
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  productId: z.string().uuid("Pick a product"),
  change: z.coerce.number().int().refine((n) => n !== 0, "Enter how many units to add or remove"),
  reason: z.string().trim().min(3, "Give a reason").max(500),
  kind: z.enum(["manual", "quarantine"]),
  toStock: z.boolean().default(false),
});

export async function requestAdjustment(input: unknown): Promise<ScanResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_adjustment", {
    p_product: d.productId,
    p_change: d.change,
    p_reason: d.reason,
    p_kind: d.kind,
    p_to_stock: d.toStock,
  });
  if (error) return fail(friendlyError(error.message));
  touch();
  return data as ScanResult;
}

export async function decideAdjustment(id: string, approve: boolean, note: string): Promise<ScanResult> {
  if (!uuid.safeParse(id).success) return fail("Request not found.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_adjustment", {
    p_adjustment: id,
    p_approve: approve,
    p_note: note.slice(0, 500) || null,
  });
  if (error) return fail(friendlyError(error.message));
  if (approve) after(() => sendQueuedLowStockAlerts());
  touch();
  return data as ScanResult;
}
