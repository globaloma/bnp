"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/deliveries";
import type { ScanResult, WarehouseLocation } from "@/types/db";

const location = z.enum(["Abuja", "Lagos", "USA"]);

export type QueueItem = {
  product_id: string;
  name: string;
  variant: string | null;
  barcode: string | null;
  merchant: string;
  unplaced: number;
  bins: string[];
};

export type BinInfo = {
  id: string;
  code: string;
  location: WarehouseLocation;
  holds: { label: string; quantity: number } | null;
};

export async function getPutawayQueue(where: WarehouseLocation): Promise<QueueItem[]> {
  if (!location.safeParse(where).success) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("putaway_queue", { p_location: where });
  return (data ?? []) as QueueItem[];
}

/** Looks up a scanned bin label in the chosen warehouse. */
export async function findBin(
  code: string,
  where: WarehouseLocation,
): Promise<{ ok: true; bin: BinInfo } | { ok: false; message: string }> {
  const supabase = await createClient();
  const value = code.trim().toUpperCase().slice(0, 60);
  const { data: bin } = await supabase
    .from("bins")
    .select("id, code, location, active, stock:bin_stock(quantity, product:products(name, variant))")
    .eq("barcode", value)
    .maybeSingle();
  if (!bin) return { ok: false, message: `Unknown bin label: ${value}` };
  if (bin.location !== where) {
    return { ok: false, message: `Bin ${bin.code} is in the ${bin.location} warehouse, not ${where}.` };
  }
  if (!bin.active) return { ok: false, message: `Bin ${bin.code} is switched off.` };

  type Stock = { quantity: number; product: { name: string; variant: string | null } | null };
  const raw = (bin as unknown as { stock: Stock | Stock[] | null }).stock;
  const stock = Array.isArray(raw) ? raw[0] : raw;
  return {
    ok: true,
    bin: {
      id: bin.id,
      code: bin.code,
      location: bin.location as WarehouseLocation,
      holds:
        stock && stock.quantity > 0 && stock.product
          ? {
              label: stock.product.variant ? `${stock.product.name} (${stock.product.variant})` : stock.product.name,
              quantity: stock.quantity,
            }
          : null,
    },
  };
}

export async function putawayScan(binId: string, code: string, qty: number): Promise<ScanResult> {
  if (!z.string().uuid().safeParse(binId).success) {
    return { ok: false, tone: "error", message: "Scan a bin first." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("putaway_scan", {
    p_bin: binId,
    p_code: code.slice(0, 80),
    p_qty: Math.floor(qty),
  });
  if (error) return { ok: false, tone: "error", message: friendlyError(error.message) };
  revalidatePath("/fc/bins");
  return data as ScanResult;
}
