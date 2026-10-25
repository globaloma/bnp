import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartProvider } from "@/components/store/cart-context";
import { ShopBaseProvider } from "@/components/marketplace/shop-base";
import { ShopHeader } from "@/components/marketplace/shop-header";
import { getShopBase, getShopOrigin } from "@/lib/marketplace/shop";
import { getCustomer } from "@/lib/marketplace/customer";
import { listCategories } from "@/lib/marketplace/data";
import { company } from "@/lib/site-content";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getShopOrigin();
  return {
    title: { absolute: "BNP Shop: shop Nigerian brands, delivered by BNP", template: "%s | BNP Shop" },
    description:
      "Shop products from Nigerian brands in one place. Every order is stored, packed and delivered by BNP Fulfillment.",
    metadataBase: new URL(origin.endsWith("/marketplace") ? SITE_URL : origin),
    openGraph: {
      type: "website",
      siteName: "BNP Shop",
      title: "BNP Shop: shop Nigerian brands, delivered by BNP",
      description: "Products from Nigerian brands in one place, packed and delivered by BNP Fulfillment.",
    },
  };
}

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const [base, customer, categories] = await Promise.all([getShopBase(), getCustomer(), listCategories()]);
  const link = (path: string) => (path === "/" ? base || "/" : `${base}${path}`);

  return (
    <ShopBaseProvider base={base}>
      <CartProvider slug="marketplace">
        <div className="flex min-h-dvh flex-col bg-cream">
          <Suspense fallback={<div className="h-[105px] bg-white shadow-sm" />}>
            <ShopHeader categories={categories} customerName={customer?.full_name || (customer ? "there" : null)} />
          </Suspense>
          <main className="flex-1">{children}</main>
          <footer className="mt-12 bg-navy text-white/80">
            <div className="container-page grid gap-8 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="font-semibold text-white">BNP Shop</p>
                <p className="mt-2 text-xs leading-relaxed">
                  Products from Nigerian brands, stored in our warehouses and packed and delivered by BNP Fulfillment.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white">Shop</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-xs">
                  <li>
                    <Link href={link("/search?deals=1")} className="hover:text-gold">
                      Deals
                    </Link>
                  </li>
                  <li>
                    <Link href={link("/search?sort=newest")} className="hover:text-gold">
                      New arrivals
                    </Link>
                  </li>
                  <li>
                    <Link href={link("/sellers")} className="hover:text-gold">
                      All sellers
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white">Help</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-xs">
                  <li>
                    <Link href={link("/track")} className="hover:text-gold">
                      Track your order
                    </Link>
                  </li>
                  <li>
                    <Link href={link("/account")} className="hover:text-gold">
                      My account
                    </Link>
                  </li>
                  <li>
                    <a href={`mailto:${company.email}`} className="hover:text-gold">
                      {company.email}
                    </a>
                  </li>
                  <li>{company.phoneDisplay}</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white">Sell on BNP Shop</p>
                <p className="mt-2 text-xs leading-relaxed">
                  Store your stock with BNP Fulfillment and your products appear here automatically.
                </p>
                <a href={SITE_URL} className="mt-2 inline-block text-xs font-semibold text-gold hover:underline">
                  Become a merchant
                </a>
              </div>
            </div>
            <div className="border-t border-white/10">
              <div className="container-page flex flex-wrap items-center justify-between gap-2 py-4 text-[11px] text-white/60">
                <span>© {new Date().getFullYear()} BNP Fulfillment</span>
                <span className="flex gap-4">
                  <a href={`${SITE_URL}/terms`} className="hover:text-white">
                    Terms
                  </a>
                  <a href={`${SITE_URL}/privacy`} className="hover:text-white">
                    Privacy
                  </a>
                </span>
              </div>
            </div>
          </footer>
        </div>
      </CartProvider>
    </ShopBaseProvider>
  );
}
