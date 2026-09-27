"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { productSchema, type ActionResult } from "@/lib/schemas/product";
import type { WarehouseLocation } from "@/types/db";
import { LOCATIONS } from "@/types/db";
import { getFulfillmentCenterEmails, sendAlertEmail } from "@/lib/notifications";

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

  const { data: existing } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .single();

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

  if (existing && d.stock > existing.stock) {
    const quantityAdded = d.stock - existing.stock;
    await supabase.from("stock_events").insert({
      partner_id: user.id,
      product_id: productId,
      product_name: d.name,
      quantity_added: quantityAdded,
    });

    const fcEmails = await getFulfillmentCenterEmails();
    if (fcEmails.length > 0) {
      const { data: merchant } = await supabase
        .from("partners")
        .select("business_name")
        .eq("id", user.id)
        .maybeSingle();

      await sendAlertEmail({
        to: fcEmails,
        subject: `Restock: ${d.name} (+${quantityAdded})`,
        html: `
          <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
            <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">A merchant just restocked</h2>
            <p style="color:#455568;font-size:13px;margin:0 0 16px;">
              ${merchant?.business_name ?? "A merchant"} added ${quantityAdded} unit${quantityAdded === 1 ? "" : "s"} of
              <strong style="color:#0f2a44;">${d.name}</strong> in ${d.location}, now at ${d.stock} in stock.
            </p>
          </div>
        `,
      });
    }
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

  const skus = payload.map((p) => p.sku).filter(Boolean);
  const { data: existingProducts } = await supabase
    .from("products")
    .select("id, sku, stock")
    .eq("partner_id", user.id)
    .in("sku", skus);
  const existingBySku = new Map((existingProducts ?? []).map((p) => [p.sku, p]));

  const { error } = await supabase
    .from("products")
    .upsert(payload, { onConflict: "partner_id,sku" });

  if (error) return { ok: false, error: error.message };

  const restocks = payload
    .map((p) => {
      const existing = existingBySku.get(p.sku);
      if (!existing || p.stock <= existing.stock) return null;
      return {
        productId: existing.id as string,
        name: p.name,
        quantityAdded: p.stock - existing.stock,
      };
    })
    .filter((r): r is { productId: string; name: string; quantityAdded: number } => r !== null);

  if (restocks.length > 0) {
    await supabase.from("stock_events").insert(
      restocks.map((r) => ({
        partner_id: user.id,
        product_id: r.productId,
        product_name: r.name,
        quantity_added: r.quantityAdded,
      })),
    );

    const fcEmails = await getFulfillmentCenterEmails();
    if (fcEmails.length > 0) {
      const { data: merchant } = await supabase
        .from("partners")
        .select("business_name")
        .eq("id", user.id)
        .maybeSingle();

      const itemRows = restocks
        .map(
          (r) =>
            `<li style="color:#0f2a44;font-size:13px;margin:2px 0;"><strong>${r.name}</strong> +${r.quantityAdded}</li>`,
        )
        .join("");

      await sendAlertEmail({
        to: fcEmails,
        subject: `Restock via CSV: ${restocks.length} product${restocks.length === 1 ? "" : "s"} updated`,
        html: `
          <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
            <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">A merchant just restocked via CSV import</h2>
            <p style="color:#455568;font-size:13px;margin:0 0 12px;">
              ${merchant?.business_name ?? "A merchant"} increased stock on ${restocks.length} product${restocks.length === 1 ? "" : "s"}:
            </p>
            <ul style="margin:0;padding-left:18px;">${itemRows}</ul>
          </div>
        `,
      });
    }
  }

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
