"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema, type AuthResult } from "@/lib/schemas/auth";

export async function signIn(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { data: signInData, error } =
    await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      ok: false,
      error:
        error.code === "invalid_credentials"
          ? "That email and password combination doesn't match our records."
          : error.message,
    };
  }

  const { data: partnerRow } = await supabase
    .from("partners")
    .select("role")
    .eq("id", signInData.user.id)
    .maybeSingle();
  const home = partnerRow?.role === "fulfillment_center" ? "/fc" : "/dashboard";

  const next = formData.get("next");
  const target =
    typeof next === "string" && next.startsWith(home) ? next : home;

  revalidatePath(home, "layout");
  redirect(target);
}

export async function signUp(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse({
    role: formData.get("role") || undefined,
    businessName: formData.get("businessName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    category: formData.get("category") || undefined,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { role, businessName, contactName, email, phone, category, password } =
    parsed.data;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        business_name: businessName,
        contact_name: contactName,
        phone,
        category: category ?? null,
      },
    },
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "user_already_exists"
          ? "An account with this email already exists. Try signing in instead."
          : error.message,
    };
  }

  const home = role === "fulfillment_center" ? "/fc" : "/dashboard";

  if (!data.session) {
    return {
      ok: true,
      message:
        "Check your email to confirm your account before signing in.",
    };
  }

  revalidatePath(home, "layout");
  redirect(home);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
