import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/marketplace/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="container-page flex justify-center py-10">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-navy">Reset your password</h1>
        <p className="mt-1 mb-5 text-sm text-graphite">Enter the email you shop with and we&apos;ll send you a link to choose a new password.</p>
        <ForgotPasswordForm linkError={sp.error === "link"} />
      </div>
    </div>
  );
}
