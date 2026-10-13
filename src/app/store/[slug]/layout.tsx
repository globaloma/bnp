import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/public";
import { CartProvider } from "@/components/store/cart-context";
import { CartSheet } from "@/components/store/cart-sheet";
import { StoreAvatar } from "@/components/store/store-avatar";
import type { StorefrontPartner } from "@/types/db";

export default async function StoreLayout({
  children,
  params,
}: LayoutProps<"/store/[slug]">) {
  const { slug } = await params;
  const supabase = createClient();
  const { data: partner } = await supabase
    .from("storefront_partners")
    .select("id, slug, business_name, category, logo_url")
    .eq("slug", slug)
    .maybeSingle<StorefrontPartner>();

  if (!partner) notFound();

  return (
    <CartProvider slug={slug}>
      <div className="flex min-h-dvh flex-col bg-cream">
        <header className="border-b border-stone bg-white">
          <div className="container-page flex h-16 items-center justify-between">
            <Link
              href={`/store/${slug}`}
              className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-navy"
            >
              <StoreAvatar name={partner.business_name} logoUrl={partner.logo_url} size="sm" />
              <span className="truncate">{partner.business_name}</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href={`/store/${slug}/track`}
                className="text-xs font-semibold text-graphite hover:text-teal-700"
              >
                Track order
              </Link>
              <CartSheet slug={slug} />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-stone py-6 text-center text-xs text-mist">
          Powered by{" "}
          <Link href="/" className="font-semibold text-teal-700 hover:underline">
            BNP Fulfillment
          </Link>
        </footer>
      </div>
    </CartProvider>
  );
}
