"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/marketplace/customer";
import { productsById } from "@/lib/marketplace/data";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const uuid = z.string().uuid();
const friendly = (m: string) => m.replace(/^.*?ERROR:\s*/, "");

export async function toggleWishlist(productId: string, add: boolean): Promise<Result> {
  if (!uuid.safeParse(productId).success) return { ok: false, error: "Product not found." };
  const customer = await getCustomer();
  if (!customer) return { ok: false, error: "Sign in to save items." };
  const supabase = await createClient();
  const { error } = add
    ? await supabase.from("wishlist_items").upsert({ customer_id: customer.id, product_id: productId })
    : await supabase.from("wishlist_items").delete().eq("customer_id", customer.id).eq("product_id", productId);
  if (error) return { ok: false, error: "Could not update your saved items." };
  revalidatePath("/marketplace/account/saved");
  return { ok: true, message: add ? "Saved" : "Removed from saved items" };
}

export async function submitReview(productId: string, rating: number, body: string): Promise<Result> {
  if (!uuid.safeParse(productId).success) return { ok: false, error: "Product not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", {
    p_product: productId,
    p_rating: Math.round(rating),
    p_body: body.slice(0, 1000),
  });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath(`/marketplace/p/${productId}`);
  return { ok: true, message: "Thank you for your review" };
}

/** Today's price and stock for the products in a cart; missing = no longer for sale. */
export async function cartSnapshot(ids: string[]): Promise<Record<string, { price: number; stock: number }>> {
  const clean = ids.filter((id) => uuid.safeParse(id).success).slice(0, 200);
  const products = await productsById(clean);
  return Object.fromEntries(products.map((p) => [p.id, { price: p.price, stock: p.stock }]));
}
