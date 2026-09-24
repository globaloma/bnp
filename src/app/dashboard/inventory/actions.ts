"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { productSchema, type ActionResult } from "@/lib/schemas/product";
import type { WarehouseLocation } from "@/types/db";
import { LOCATIONS } from "@/types/db";

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
    stock: formData.get("stock"),
    location: formData.get("location"),
    shippingFee: formData.get("shippingFee") || 0,
    pickupEnabled: formData.get("pickupEnabled") === "on",
    imageUrl: formData.get("imageUrl") || undefined,
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
  const { error } = await supabase.from("products").insert({
    partner_id: user.id,
    name: d.name,
    sku: d.sku || null,
    category: d.category || null,
    cost_price: d.costPrice,
    sale_price: d.salePrice,
    vat: d.vat,
    stock: d.stock,
    location: d.location,
    shipping_fee: d.shippingFee,
    pickup_enabled: d.pickupEnabled,
    image_url: d.imageUrl || null,
    published: d.published,
  });

  if (error) {
    return { ok: false, error: error.message };
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
    stock: formData.get("stock"),
    location: formData.get("location"),
    shippingFee: formData.get("shippingFee") || 0,
    pickupEnabled: formData.get("pickupEnabled") === "on",
    imageUrl: formData.get("imageUrl") || undefined,
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
      category: d.category || null,
      cost_price: d.costPrice,
      sale_price: d.salePrice,
      vat: d.vat,
      stock: d.stock,
      location: d.location,
      shipping_fee: d.shippingFee,
      pickup_enabled: d.pickupEnabled,
      image_url: d.imageUrl || null,
    })
    .eq("id", productId);

  if (error) {
    return { ok: false, error: error.message };
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
): Promise<ActionResult & { imported?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  if (rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > 500) {
    return { ok: false, error: "Import is limited to 500 rows at a time." };
  }

  const payload = rows.map((r) => ({
    partner_id: user.id,
    sku: r.sku,
    name: r.name,
    category: r.category || null,
    cost_price: r.cost_price ?? 0,
    sale_price: r.sale_price,
    vat: r.vat ?? 7.5,
    stock: r.stock ?? 0,
    location: r.location && (LOCATIONS as string[]).includes(r.location) ? r.location : "Abuja",
    shipping_fee: r.shipping_fee ?? 0,
    pickup_enabled: r.pickup_enabled ?? false,
    image_url: r.image_url || null,
    published: r.published ?? true,
  }));

  const { error } = await supabase
    .from("products")
    .upsert(payload, { onConflict: "partner_id,sku" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true, imported: payload.length };
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
