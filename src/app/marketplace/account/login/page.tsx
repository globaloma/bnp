import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/marketplace/customer";
import { getShopBase } from "@/lib/marketplace/shop";
import { SignInForm } from "@/components/marketplace/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/account";
  if (await getCustomer()) redirect(`${await getShopBase()}${next}`);
  return (
    <div className="container-page flex justify-center py-10">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-navy">Sign in</h1>
        <p className="mt-1 mb-5 text-sm text-graphite">Track orders, save addresses and check out faster.</p>
        <SignInForm next={next} linkError={sp.error === "link"} />
      </div>
    </div>
  );
}
