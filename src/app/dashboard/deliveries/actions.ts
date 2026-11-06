"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { WarehouseLocation } from "@/types/db";
import { announceDeliveries, friendlyError } from "@/lib/deliveries";
import { displayName } from "@/lib/variants";

const announceSchema = z
  .object({
    location: z.enum(["Abuja", "Lagos", "USA"]),
    expectedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("")),
    note: z.string().trim().max(1000).optional(),
    // Products the merchant already has.
    lines: z
      .array(z.object({ productId: z.string().uuid(), qty: z.coerce.number().int().min(1).max(100000) }))
      .max(300)
      .optional()
      .default([]),
    // Products the merchant doesn't have yet: created as unpublished drafts,
    // then added to this delivery. Price is optional and defaults to 0.
    newProducts: z
      .array(
        z.object({
          name: z.string().trim().min(2, "Enter a name for the new product").max(140),
          variant: z.string().trim().max(60).optional().or(z.literal("")),
          sku: z.string().trim().max(60).optional().or(z.literal("")),
          price: z
            .union([z.literal(""), z.coerce.number().min(0).max(1_000_000_000)])
            .optional()
            .transform((v) => (v === "" || v === undefined ? 0 : v)),
          qty: z.coerce.number().int().min(1).max(100000),
        }),
      )
      .max(100)
      .optional()
      .default([]),
  })
  .refine((d) => d.lines.length + d.newProducts.length > 0, {
    message: "Add at least one product with a quantity.",
  });

export async function announceDelivery(
  input: unknown,
): Promise<{ ok: true; refs: string[] } | { ok: false; error: string }> {
  const parsed = announceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the delivery." };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const [{ data: merchant }, { data: products }] = await Promise.all([
    supabase.from("partners").select("id, business_name").eq("id", user.id).single(),
    supabase
      .from("products")
      .select("id, name, variant, location")
      .eq("partner_id", user.id)
      .in(
        "id",
        d.lines.map((l) => l.productId),
      ),
  ]);
  if (!merchant) return { ok: false, error: "Your account couldn't be found." };
  const byId = new Map((products ?? []).map((p) => [p.id as string, p]));

  type Line = { productId: string; qty: number; location: WarehouseLocation; label: string };

  // Create any brand-new products first, as unpublished drafts the merchant can
  // finish later on Inventory. Their stock joins this delivery.
  const newLines: Line[] = [];
  for (const np of d.newProducts) {
    const label = np.variant ? `${np.name} (${np.variant})` : np.name;
    const { data: created, error } = await supabase
      .from("products")
      .insert({
        partner_id: user.id,
        name: np.name,
        variant: np.variant || null,
        sku: np.sku || null,
        sale_price: np.price,
        location: d.location,
        published: false,
      })
      .select("id")
      .single();
    if (error || !created) {
      const taken =
        !!error &&
        (error.message.includes("products_partner_sku_key") || error.message.includes("products_barcode_key"));
      return {
        ok: false,
        error: taken
          ? `You already have a product with SKU ${np.sku}. Use a different SKU, or leave it blank.`
          : `Couldn't add "${np.name}". Please try again.`,
      };
    }
    newLines.push({ productId: created.id, qty: np.qty, location: d.location, label });
  }

  const existingLines: Line[] = d.lines.flatMap((l) => {
    const p = byId.get(l.productId);
    if (!p) return [];
    return [{ productId: l.productId, qty: l.qty, location: d.location, label: displayName(p) }];
  });

  const result = await announceDeliveries(supabase, merchant, [...existingLines, ...newLines], {
    expectedOn: d.expectedOn || null,
    note: d.note || null,
  });
  if (!result.ok) return result;

  revalidatePath("/dashboard/deliveries");
  if (d.newProducts.length > 0) {
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard");
  }
  return { ok: true, refs: result.refs };
}

export async function cancelDelivery(
  deliveryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(deliveryId).success) return { ok: false, error: "Delivery not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_delivery", { p_delivery: deliveryId });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/dashboard/deliveries");
  return { ok: true };
}
