"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  changePasswordSchema,
  profileSchema,
  type SettingsResult,
} from "@/lib/schemas/settings";

// Shared by the merchant (/dashboard/settings) and fulfillment center
// (/fc/settings) pages. Both edit the signed-in partner's own row, and the
// columns written here are exactly the ones 0017 grants UPDATE on.

export async function updateProfile(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const parsed = profileSchema.safeParse({
    businessName: formData.get("businessName"),
    contactName: formData.get("contactName"),
    phone: formData.get("phone"),
    category: formData.get("category") || undefined,
    logoUrl: formData.get("logoUrl") ?? "",
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

  const { businessName, contactName, phone, category, logoUrl } = parsed.data;

  // Only accept logos from our own storage bucket, in this partner's folder.
  const logoPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/partner-logos/${user.id}/`;
  if (logoUrl && !logoUrl.startsWith(logoPrefix)) {
    return { ok: false, error: "Upload your logo again." };
  }

  const update: Record<string, string | null> = {
    business_name: businessName,
    contact_name: contactName,
    phone,
    logo_url: logoUrl || null,
  };
  // Fulfillment centers don't have a product category, so their form
  // doesn't send one. Leave the stored value alone in that case.
  if (formData.has("category")) update.category = category ?? null;

  const { error } = await supabase.from("partners").update(update).eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  revalidatePath("/fc", "layout");
  return { ok: true, message: "Your details have been saved." };
}

export async function changePassword(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
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
  if (!user?.email) return { ok: false, error: "Your session expired, sign in again." };

  // Confirm it's really the account owner before changing the password, so
  // a session left open on a shared computer isn't enough on its own.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { currentPassword: ["That isn't your current password"] },
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "same_password"
          ? "Your new password must be different from your current one."
          : error.message,
    };
  }

  return { ok: true, message: "Your password has been changed." };
}
