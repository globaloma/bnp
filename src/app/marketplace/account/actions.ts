"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { guardSubmission, withinRateLimit } from "@/lib/spam-guard";
import { getCustomer } from "@/lib/marketplace/customer";
import { getShopBase, getShopOrigin } from "@/lib/marketplace/shop";

export type AccountResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Only ever go somewhere inside the shop after signing in. */
function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+()\s-]+$/, "Enter a valid phone number"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

export async function customerSignUp(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const guard = await guardSubmission("signup", formData);
  if (!guard.ok) {
    return guard.reason === "bot"
      ? { ok: true, message: "Check your email to confirm your account." }
      : { ok: false, error: guard.message };
  }
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const d = parsed.data;
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const origin = await getShopOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      data: { account_type: "customer", full_name: d.fullName, phone: d.phone },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "user_already_exists"
          ? "An account with this email already exists. Sign in instead."
          : error.message,
    };
  }
  // Supabase answers a sign-up for an email that already has an account
  // with a stand-in user that has no identities, and sends nothing. That
  // email may be a BNP business login, which can't double as a shop account.
  if (data.user && (data.user.identities ?? []).length === 0) {
    return {
      ok: false,
      error:
        "This email already has an account. Sign in instead, or if it's your BNP business login, use a different email for your shop account.",
    };
  }
  if (!data.session) {
    return { ok: true, message: `We sent a confirmation link to ${d.email}. Open it to finish creating your account.` };
  }
  redirect(`${await getShopBase()}${next}`);
}

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function customerSignIn(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  if (!(await withinRateLimit("login", parsed.data.email))) {
    return { ok: false, error: "Too many sign-in attempts. Please wait 15 minutes and try again." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      error:
        error.code === "email_not_confirmed"
          ? "Please confirm your email first. We sent you a link when you signed up."
          : error.code === "invalid_credentials"
            ? "That email and password don't match an account."
            : error.message,
    };
  }
  const { data: customer } = await supabase.from("customers").select("id").eq("id", data.user.id).maybeSingle();
  if (!customer) {
    // A merchant or staff login: those live on bnpfulfillment.com, not the shop.
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "This is a BNP Fulfillment business login. Create a separate shop account to buy on BNP Shop.",
    };
  }
  redirect(`${await getShopBase()}${safeNext(formData.get("next"))}`);
}

export async function customerSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect((await getShopBase()) || "/");
}

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).default("Home"),
  fullName: z.string().trim().min(2, "Enter a name").max(120),
  phone: z.string().trim().min(7, "Enter a phone number").max(30),
  address: z.string().trim().min(5, "Enter the address").max(300),
});

export async function saveAddress(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, error: "Sign in again." };
  const parsed = addressSchema.safeParse({
    label: formData.get("label") || "Home",
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = await createClient();
  const { count } = await supabase.from("customer_addresses").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("customer_addresses").insert({
    customer_id: customer.id,
    label: parsed.data.label,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    address: parsed.data.address,
    is_default: (count ?? 0) === 0,
  });
  if (error) return { ok: false, error: "Could not save the address." };
  revalidatePath("/marketplace/account/addresses");
  return { ok: true, message: "Address saved" };
}

export async function deleteAddress(id: string): Promise<AccountResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Address not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the address." };
  revalidatePath("/marketplace/account/addresses");
  return { ok: true, message: "Address deleted" };
}

export async function makeDefaultAddress(id: string): Promise<AccountResult> {
  const customer = await getCustomer();
  if (!customer || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Address not found." };
  const supabase = await createClient();
  await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", customer.id);
  const { error } = await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id);
  if (error) return { ok: false, error: "Could not update the address." };
  revalidatePath("/marketplace/account/addresses");
  return { ok: true, message: "Default address updated" };
}

export async function updateProfile(_prev: AccountResult | null, formData: FormData): Promise<AccountResult> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, error: "Sign in again." };
  const parsed = z
    .object({ fullName: z.string().trim().min(2, "Enter your name").max(120), phone: z.string().trim().max(30) })
    .safeParse({ fullName: formData.get("fullName"), phone: formData.get("phone") ?? "" });
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", customer.id);
  if (error) return { ok: false, error: "Could not save your details." };
  revalidatePath("/marketplace", "layout");
  return { ok: true, message: "Details saved" };
}
