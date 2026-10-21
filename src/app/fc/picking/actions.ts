"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/deliveries";
import type { OrderRider, OrderStatus, ScanResult, WarehouseLocation } from "@/types/db";

// Picking and dispatch: each call goes through a database function
// (migration 0024) that checks the caller is warehouse staff.

const uuid = z.string().uuid();
const orderRef = z.string().trim().min(1).max(40);
const location = z.enum(["Abuja", "Lagos", "USA"]);

export type PickListRow = {
  order_id: string;
  partner_id: string;
  order_ref: string;
  merchant: string;
  customer: string;
  rider: OrderRider;
  status: OrderStatus;
  lines: number;
  units: number;
  picked: number;
  placed_at: string;
};

export async function getPickList(where: WarehouseLocation): Promise<PickListRow[]> {
  if (!location.safeParse(where).success) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("pick_list", { p_location: where });
  return (data ?? []) as PickListRow[];
}

export async function startPicking(partnerId: string, ref: string): Promise<ScanResult> {
  if (!uuid.safeParse(partnerId).success || !orderRef.safeParse(ref).success) {
    return { ok: false, tone: "error", message: "Order not found." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_picking", { p_partner: partnerId, p_order_ref: ref });
  if (error) return { ok: false, tone: "error", message: friendlyError(error.message) };
  revalidatePath("/fc/picking");
  revalidatePath("/fc/orders");
  return data as ScanResult;
}

export async function pickScan(
  partnerId: string,
  ref: string,
  binId: string,
  code: string,
  qty: number,
): Promise<ScanResult> {
  if (!uuid.safeParse(partnerId).success || !orderRef.safeParse(ref).success) {
    return { ok: false, tone: "error", message: "Order not found." };
  }
  if (!uuid.safeParse(binId).success) return { ok: false, tone: "error", message: "Scan the bin first." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pick_scan", {
    p_partner: partnerId,
    p_order_ref: ref,
    p_bin: binId,
    p_code: code.slice(0, 80),
    p_qty: Math.floor(qty),
  });
  if (error) return { ok: false, tone: "error", message: friendlyError(error.message) };
  const result = data as ScanResult;
  if (result.complete) {
    revalidatePath("/fc/picking");
    revalidatePath("/fc/dispatch");
    revalidatePath("/fc/orders");
  }
  return result;
}

export async function pickUndo(partnerId: string, ref: string, productId: string): Promise<ScanResult> {
  if (!uuid.safeParse(partnerId).success || !uuid.safeParse(productId).success) {
    return { ok: false, tone: "error", message: "Nothing to take back." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pick_undo", {
    p_partner: partnerId,
    p_order_ref: ref,
    p_product: productId,
  });
  if (error) return { ok: false, tone: "error", message: friendlyError(error.message) };
  return data as ScanResult;
}

export async function dispatchScan(code: string): Promise<ScanResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dispatch_scan", { p_code: code.slice(0, 80) });
  if (error) return { ok: false, tone: "error", message: friendlyError(error.message) };
  revalidatePath("/fc/dispatch");
  revalidatePath("/fc/orders");
  return data as ScanResult;
}
