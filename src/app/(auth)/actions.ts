"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type AuthResult,
} from "@/lib/schemas/auth";
import { roleHome } from "@/lib/roles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

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
    if (error.code === "email_not_confirmed") {
      return {
        ok: false,
        error:
          "Please confirm your email address before signing in. We sent a confirmation link to your inbox when you signed up.",
        unconfirmedEmail: parsed.data.email,
      };
    }
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
  const home = roleHome(partnerRow?.role);

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

  const home = roleHome(role);

  if (!data.session) {
    return {
      ok: true,
      message:
        "Check your email to confirm your account before signing in.",
      pendingEmail: email,
    };
  }

  revalidatePath(home, "layout");
  redirect(home);
}

export async function resendConfirmation(
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const parsed = signInSchema.shape.email.safeParse(email);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "over_email_send_rate_limit" || error.status === 429
          ? "Too many emails sent. Please wait a few minutes and try again."
          : error.message,
    };
  }

  return { ok: true, message: "Confirmation email sent. Check your inbox." };
}

export async function requestPasswordReset(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/reset-password`,
  });

  if (error && (error.code === "over_email_send_rate_limit" || error.status === 429)) {
    return {
      ok: false,
      error: "Too many emails sent. Please wait a few minutes and try again.",
    };
  }

  // Same message whether or not the account exists, so this form can't be
  // used to find out which emails are registered.
  return {
    ok: true,
    message:
      "If an account exists for that email, we've sent a link to reset your password.",
    pendingEmail: parsed.data.email,
  };
}

export async function updatePassword(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = resetPasswordSchema.safeParse({
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

  if (!user) {
    return {
      ok: false,
      error: "Your reset link has expired. Request a new one and try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "same_password"
          ? "Your new password must be different from your old one."
          : error.message,
    };
  }

  const { data: partnerRow } = await supabase
    .from("partners")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const home = roleHome(partnerRow?.role);

  revalidatePath(home, "layout");
  redirect(home);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
