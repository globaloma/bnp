import Link from "next/link";
import { getShopBase } from "@/lib/marketplace/shop";

export default async function MarketplaceNotFound() {
  const base = await getShopBase();
  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      <p className="text-xs font-semibold tracking-[0.14em] text-teal-700 uppercase">Not found</p>
      <h1 className="mt-2 text-2xl font-semibold text-navy">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-sm text-graphite">The product may have sold out or been removed by the seller.</p>
      <Link href={base || "/"} className="mt-6 rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-navy hover:bg-gold-300">
        Back to the shop
      </Link>
    </div>
  );
}
