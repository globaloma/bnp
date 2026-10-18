"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { emailReceivingSummary, friendlyError } from "@/lib/deliveries";
import { displayName } from "@/lib/variants";
import type { ScanResult, WarehouseLocation } from "@/types/db";

// Receiving: each call goes through a database function (migration 0023)
// that checks the caller is warehouse staff and applies the stock change.

const uuid = z.string().uuid();

export async function receiveScan(deliveryId: string, code: string, qty: number): Promise<ScanResult> {
  if (!uuid.safeParse(deliveryId).success) return { ok: false, tone: "error", message: "Delivery not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_scan", {
    p_delivery: deliveryId,
    p_code: code.slice(0, 80),
    p_qty: Math.floor(qty),
  });
  if (error) return { ok: false, tone: "error", message: friendlyError(error.message) };
  return data as ScanResult;
}

export async function receiveUndo(deliveryId: string, productId: string): Promise<ScanResult> {
  if (!uuid.safeParse(deliveryId).success || !uuid.safeParse(productId).success) {
    return { ok: false, tone: "error", message: "Nothing to take back." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_undo", {
    p_delivery: deliveryId,
    p_product: productId,
    p_qty: 1,
  });
  if (error) return { ok: false, tone: "error", message: friendlyError(error.message) };
  return data as ScanResult;
}

export async function completeDelivery(
  deliveryId: string,
): Promise<{ ok: true; ref: string; gaps: number } | { ok: false; error: string }> {
  if (!uuid.safeParse(deliveryId).success) return { ok: false, error: "Delivery not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_delivery", { p_delivery: deliveryId });
  if (error) return { ok: false, error: friendlyError(error.message) };
  const result = data as { ref: string; gaps: unknown[] };

  const { data: delivery } = await supabase
    .from("inbound_deliveries")
    .select(
      "ref, location, merchant:partners(business_name, email), lines:inbound_delivery_lines(expected_qty, received_qty, product:products(name, variant))",
    )
    .eq("id", deliveryId)
    .single();

  type Row = {
    ref: string;
    location: WarehouseLocation;
    merchant: { business_name: string; email: string | null } | null;
    lines: { expected_qty: number; received_qty: number; product: { name: string; variant: string | null } | null }[];
  };
  const d = delivery as unknown as Row | null;
  if (d?.merchant?.email) {
    await emailReceivingSummary({
      to: d.merchant.email,
      merchantName: d.merchant.business_name,
      ref: d.ref,
      location: d.location,
      lines: d.lines.map((l) => ({
        expected_qty: l.expected_qty,
        received_qty: l.received_qty,
        label: l.product ? displayName(l.product) : "Product",
      })),
    });
  }

  revalidatePath("/fc/receiving");
  revalidatePath("/fc/putaway");
  revalidatePath("/fc/inventory");
  return { ok: true, ref: result.ref, gaps: result.gaps.length };
}

const unannouncedSchema = z.object({
  partnerId: z.string().uuid("Pick a merchant"),
  location: z.enum(["Abuja", "Lagos", "USA"]),
  note: z.string().trim().max(500).optional(),
});

export async function startUnannounced(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = unannouncedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_unannounced_delivery", {
    p_partner: parsed.data.partnerId,
    p_location: parsed.data.location,
    p_note: parsed.data.note || null,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/fc/receiving");
  return { ok: true, id: data as string };
}
