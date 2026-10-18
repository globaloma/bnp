"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/schemas/order";

const binSchema = z.object({
  location: z.enum(["Abuja", "Lagos", "USA"]),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{0,19}$/, "Use letters, numbers and dashes, e.g. B-02-03"),
});

// Bins are warehouse data: the database only lets fulfillment centers and
// admins create or change them (RLS on bins, migration 0022).
export async function createBin(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = binSchema.safeParse({
    location: formData.get("location"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { error } = await supabase
    .from("bins")
    .insert({ location: parsed.data.location, code: parsed.data.code, created_by: user.id });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? `Bin ${parsed.data.code} already exists in ${parsed.data.location}.`
          : error.message,
    };
  }

  revalidatePath("/fc/bins");
  return { ok: true };
}

export async function setBinActive(binId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("bins").update({ active }).eq("id", binId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fc/bins");
  return { ok: true };
}
