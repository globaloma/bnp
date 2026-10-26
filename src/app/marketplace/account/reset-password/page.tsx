import type { Metadata } from "next";
import Link from "next/link";
import { getCustomer } from "@/lib/marketplace/customer";
import { getShopBase } from "@/lib/marketplace/shop";
import { NewPasswordForm } from "@/components/marketplace/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The reset link signs the shopper in via /auth/callback. Without that
  // session there's no account to set a password on.
  const [customer, base] = await Promise.all([getCustomer(), getShopBase()]);
  return (
    <div className="container-page flex justify-center py-10">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
        {customer ? (
          <>
            <h1 className="text-xl font-semibold text-navy">Choose a new password</h1>
            <p className="mt-1 mb-5 text-sm text-graphite">
              For <span className="font-semibold text-navy">{customer.email}</span>.
            </p>
            <NewPasswordForm />
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-navy">Link expired</h1>
            <p className="mt-2 text-sm text-graphite">This reset link is invalid or has expired. Ask for a new one to continue.</p>
            <Link href={`${base}/account/forgot-password`} className="mt-5 inline-block text-sm font-semibold text-teal-700 hover:underline">
              Ask for a new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
