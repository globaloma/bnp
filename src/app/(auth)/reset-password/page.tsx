import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The reset link signs the user in via /auth/callback. Without that
  // session there's no account to set a password on.
  if (!user) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,42,68,0.5)]">
        <h1 className="text-xl font-semibold text-navy">Link expired</h1>
        <p className="mt-2 text-sm text-graphite">
          This password reset link is invalid or has expired. Request a new
          one to continue.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm font-semibold text-teal hover:text-teal-700"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm email={user.email ?? ""} />;
}
