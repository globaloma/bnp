"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { productSchema, type ActionResult } from "@/lib/schemas/product";

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
  });

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
