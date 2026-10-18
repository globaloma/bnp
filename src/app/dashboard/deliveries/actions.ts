"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { announceDeliveries, friendlyError } from "@/lib/deliveries";
import { displayName } from "@/lib/variants";

const announceSchema = z.object({
  location: z.enum(["Abuja", "Lagos", "USA"]),
  expectedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(1000).optional(),
  lines: z
    .array(z.object({ productId: z.string().uuid(), qty: z.coerce.number().int().min(1).max(100000) }))
    .min(1, "Add at least one product with a quantity.")
    .max(300),
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

  const result = await announceDeliveries(
    supabase,
    merchant,
    d.lines.flatMap((l) => {
      const p = byId.get(l.productId);
      if (!p) return [];
      return [{ productId: l.productId, qty: l.qty, location: d.location, label: displayName(p) }];
    }),
    { expectedOn: d.expectedOn || null, note: d.note || null },
  );
  if (!result.ok) return result;

  revalidatePath("/dashboard/deliveries");
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
