import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/public";
import { getShopBase } from "@/lib/marketplace/shop";
import { SellerAvatar } from "@/components/marketplace/seller-avatar";
import type { MarketMerchant } from "@/lib/marketplace/data";

export const metadata: Metadata = { title: "All sellers" };

export default async function SellersPage() {
  const [base, { data }] = await Promise.all([
    getShopBase(),
    createClient().from("marketplace_merchants").select("*").order("business_name"),
  ]);
  const merchants = (data ?? []) as MarketMerchant[];

  return (
    <div className="container-page py-5">
      <h1 className="text-xl font-semibold text-navy">All sellers</h1>
      <p className="mt-1 text-sm text-graphite">Every brand on BNP Shop keeps its stock in a BNP warehouse.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {merchants.map((m) => (
          <Link
            key={m.id}
            href={`${base}/seller/${m.slug}`}
            className="flex flex-col items-center gap-2 rounded-lg bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md"
          >
            <SellerAvatar name={m.business_name} logoUrl={m.logo_url} />
            <span className="line-clamp-2 text-sm font-semibold text-navy">{m.business_name}</span>
            {m.category ? <span className="text-[11px] text-mist">{m.category}</span> : null}
            <span className="text-[11px] text-teal-700">
              {m.product_count} product{m.product_count === 1 ? "" : "s"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
