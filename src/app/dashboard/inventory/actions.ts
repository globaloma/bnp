"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { productSchema, type ActionResult } from "@/lib/schemas/product";
import type { WarehouseLocation } from "@/types/db";
import { LOCATIONS } from "@/types/db";
import { announceDeliveries } from "@/lib/deliveries";

function skuTakenMessage(message: string, sku?: string): string {
  return message.includes("products_partner_sku_key") || message.includes("products_barcode_key")
    ? `You already have a product with SKU ${sku ?? "that code"}. Use a different SKU.`
    : message;
}

export type ProductCsvRow = {
  sku: string;
  name: string;
  category?: string;
  cost_price?: number;
  sale_price: number;
  vat?: number;
  stock?: number;
  location?: WarehouseLocation;
  shipping_fee?: number;
  pickup_enabled?: boolean;
  image_url?: string;
  description?: string;
  /** Value per unit; only fills products that don't have one yet. */
  declared_value?: number;
  variant?: string;
  published?: boolean;
};

export async function addProduct(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku") || undefined,
    category: formData.get("category") || undefined,
    costPrice: formData.get("costPrice") || 0,
    salePrice: formData.get("salePrice"),
    vat: formData.get("vat") || 7.5,
    incoming: formData.get("incoming") || 0,
    location: formData.get("location"),
    lowStockThreshold: formData.get("lowStockThreshold") ?? "",
    declaredValue: formData.get("declaredValue") ?? "",
    weightKg: formData.get("weightKg") ?? "",
    shippingFee: formData.get("shippingFee") || 0,
    pickupEnabled: formData.get("pickupEnabled") === "on",
    imageUrl: formData.get("imageUrl") || undefined,
    description: formData.get("description") ?? undefined,
    variant: formData.get("variant") || undefined,
    retailBarcode: formData.get("retailBarcode") ?? "",
    published: formData.get("published") === "on",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d = parsed.data;

  // "Add variant" passes the product it's a variant of; variants share a
  // group so the storefront shows them as one product with options.
  let groupId: string | null = null;
  const variantOf = formData.get("variantOf");
  if (typeof variantOf === "string" && variantOf) {
    const { data: parent } = await supabase
      .from("products")
      .select("id, group_id")
      .eq("id", variantOf)
      .eq("partner_id", user.id)
      .maybeSingle();
    if (parent) {
      groupId = parent.group_id ?? parent.id;
      if (!parent.group_id) {
        await supabase.from("products").update({ group_id: parent.id }).eq("id", parent.id);
      }
    }
  }

  const { data: created, error } = await supabase.from("products").insert({
    partner_id: user.id,
    name: d.name,
    sku: d.sku || null,
    variant: d.variant || null,
    group_id: groupId,
    retail_barcode: d.retailBarcode || null,
    category: d.category || null,
    cost_price: d.costPrice,
    sale_price: d.salePrice,
    vat: d.vat,
    location: d.location,
    low_stock_threshold: d.lowStockThreshold,
    declared_value: d.declaredValue,
    weight_kg: d.weightKg,
    shipping_fee: d.shippingFee,
    pickup_enabled: d.pickupEnabled,
    image_url: d.imageUrl || null,
    description: d.description || null,
    published: d.published,
  }).select("id").single();

  if (error) {
    return { ok: false, error: skuTakenMessage(error.message, d.sku) };
  }

  // Stock for a new product arrives as an announced delivery.
  if (d.incoming > 0 && created) {
    const { data: merchant } = await supabase
      .from("partners")
      .select("id, business_name")
      .eq("id", user.id)
      .single();
    if (merchant) {
      const announced = await announceDeliveries(supabase, merchant, [
        {
          productId: created.id,
          qty: d.incoming,
          location: d.location,
          label: d.variant ? `${d.name} (${d.variant})` : d.name,
        },
      ]);
      if (!announced.ok) {
        revalidatePath("/dashboard/inventory");
        return { ok: false, error: `Product saved, but the delivery wasn't announced: ${announced.error}` };
      }
    }
    revalidatePath("/dashboard/deliveries");
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function editProduct(
  productId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku") || undefined,
    category: formData.get("category") || undefined,
    costPrice: formData.get("costPrice") || 0,
    salePrice: formData.get("salePrice"),
    vat: formData.get("vat") || 7.5,
    incoming: formData.get("incoming") || 0,
    location: formData.get("location"),
    lowStockThreshold: formData.get("lowStockThreshold") ?? "",
    declaredValue: formData.get("declaredValue") ?? "",
    weightKg: formData.get("weightKg") ?? "",
    shippingFee: formData.get("shippingFee") || 0,
    pickupEnabled: formData.get("pickupEnabled") === "on",
    imageUrl: formData.get("imageUrl") || undefined,
    description: formData.get("description") ?? undefined,
    variant: formData.get("variant") || undefined,
    retailBarcode: formData.get("retailBarcode") ?? "",
    published: formData.get("published") === "on",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d = parsed.data;

  const { error } = await supabase
    .from("products")
    .update({
      name: d.name,
      sku: d.sku || null,
      variant: d.variant || null,
      retail_barcode: d.retailBarcode || null,
      category: d.category || null,
      cost_price: d.costPrice,
      sale_price: d.salePrice,
      vat: d.vat,
      location: d.location,
      low_stock_threshold: d.lowStockThreshold,
      weight_kg: d.weightKg,
      ...(d.declaredValue !== null && formData.get("declaredValueLocked") !== "1"
        ? { declared_value: d.declaredValue }
        : {}),
      shipping_fee: d.shippingFee,
      pickup_enabled: d.pickupEnabled,
      image_url: d.imageUrl || null,
      description: d.description || null,
    })
    .eq("id", productId);

  if (error) {
    return { ok: false, error: skuTakenMessage(error.message, d.sku) };
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function importProducts(
  rows: ProductCsvRow[],
): Promise<ActionResult & { imported?: number; announced?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  if (rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > 500) {
    return { ok: false, error: "Import is limited to 500 rows at a time." };
  }

  // Only touch descriptions when the file has a description column, so
  // re-importing a stock sheet without one doesn't wipe descriptions
  // merchants typed in by hand.
  const hasDescription = rows.some((r) => r.description !== undefined);

  const payload = rows.map((r) => ({
    partner_id: user.id,
    sku: r.sku,
    name: r.name,
    category: r.category || null,
    cost_price: r.cost_price ?? 0,
    sale_price: r.sale_price,
    vat: r.vat ?? 7.5,
    variant: r.variant?.trim().slice(0, 60) || null,
    location: r.location && (LOCATIONS as string[]).includes(r.location) ? r.location : "Abuja",
    shipping_fee: r.shipping_fee ?? 0,
    pickup_enabled: r.pickup_enabled ?? false,
    image_url: r.image_url || null,
    ...(hasDescription ? { description: r.description?.trim().slice(0, 2000) || null } : {}),
    published: r.published ?? true,
  }));

  const { error } = await supabase
    .from("products")
    .upsert(payload, { onConflict: "partner_id,sku" });

  if (error) return { ok: false, error: error.message };

  // Declared values lock once set, so the file can only fill in missing ones.
  for (const r of rows) {
    if (r.declared_value === undefined || !Number.isFinite(r.declared_value) || r.declared_value < 0) continue;
    await supabase
      .from("products")
      .update({ declared_value: r.declared_value })
      .eq("partner_id", user.id)
      .eq("sku", r.sku)
      .is("declared_value", null);
  }

  // The stock column is what the merchant is sending us: one announced
  // delivery per warehouse. On-hand changes when it's scanned in.
  const sending = rows.filter((r) => (r.stock ?? 0) > 0);
  let announcedNote = "";
  if (sending.length > 0) {
    const { data: saved } = await supabase
      .from("products")
      .select("id, sku, name, variant, location")
      .eq("partner_id", user.id)
      .in(
        "sku",
        sending.map((r) => r.sku),
      );
    const bySku = new Map((saved ?? []).map((p) => [p.sku as string, p]));
    const { data: merchant } = await supabase
      .from("partners")
      .select("id, business_name")
      .eq("id", user.id)
      .single();
    const lines = sending.flatMap((r) => {
      const p = bySku.get(r.sku);
      if (!p) return [];
      return [
        {
          productId: p.id as string,
          qty: Math.floor(r.stock ?? 0),
          location: p.location as WarehouseLocation,
          label: p.variant ? `${p.name} (${p.variant})` : (p.name as string),
        },
      ];
    });
    if (merchant && lines.length > 0) {
      const announced = await announceDeliveries(supabase, merchant, lines);
      if (!announced.ok) {
        return {
          ok: false,
          error: `Products saved, but the delivery wasn't announced: ${announced.error}`,
        };
      }
      announcedNote = announced.refs.join(", ");
      revalidatePath("/dashboard/deliveries");
    }
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true, imported: payload.length, announced: announcedNote || undefined };
}

export async function toggleProductPublished(
  productId: string,
  published: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ published })
    .eq("id", productId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/inventory");
  return { ok: true };
}

export async function setChargesVat(chargesVat: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { error } = await supabase
    .from("partners")
    .update({ charges_vat: chargesVat })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

const deliveryZonesSchema = z
  .array(
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1, "Every zone needs a name").max(80),
      fee: z.coerce.number().min(0, "Delivery fee can't be negative"),
    }),
  )
  .max(50, "That's a lot of zones, keep it to 50 or fewer");

/**
 * Replaces the merchant's whole zone list with what the editor submitted:
 * rows missing from the list are deleted, rows with an id are updated, and
 * rows without one are inserted.
 */
export async function saveDeliveryZones(input: unknown): Promise<ActionResult> {
  const parsed = deliveryZonesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your zones." };
  }
  const zones = parsed.data;

  const names = zones.map((zone) => zone.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    return { ok: false, error: "Two zones have the same name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { data: existing, error: readError } = await supabase
    .from("delivery_zones")
    .select("id")
    .eq("partner_id", user.id);
  if (readError) return { ok: false, error: readError.message };

  const keepIds = new Set(zones.flatMap((zone) => (zone.id ? [zone.id] : [])));
  const removeIds = (existing ?? []).map((row) => row.id).filter((id) => !keepIds.has(id));

  if (removeIds.length) {
    const { error } = await supabase.from("delivery_zones").delete().in("id", removeIds);
    if (error) return { ok: false, error: error.message };
  }

  for (const zone of zones.filter((zone) => zone.id)) {
    const { error } = await supabase
      .from("delivery_zones")
      .update({ name: zone.name, fee: zone.fee })
      .eq("id", zone.id!);
    if (error) return { ok: false, error: error.message };
  }

  const inserts = zones
    .filter((zone) => !zone.id)
    .map((zone) => ({ partner_id: user.id, name: zone.name, fee: zone.fee }));
  if (inserts.length) {
    const { error } = await supabase.from("delivery_zones").insert(inserts);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/inventory");
  return { ok: true };
}
