import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { getMerchant, PAGE_SIZE, searchProducts } from "@/lib/marketplace/data";
import { getShopBase } from "@/lib/marketplace/shop";
import { ProductTile } from "@/components/marketplace/product-tile";
import { SellerAvatar } from "@/components/marketplace/seller-avatar";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchant(slug);
  return merchant
    ? { title: merchant.business_name, description: merchant.store_description ?? `Shop ${merchant.business_name} on BNP Shop.` }
    : { title: "Seller" };
}

export default async function SellerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const raw = await searchParams;
  const page = Math.max(1, Math.floor(Number(raw.page) || 1));
  const [merchant, base] = await Promise.all([getMerchant(slug), getShopBase()]);
  if (!merchant) notFound();
  const result = await searchProducts({ seller: slug, page, sort: "popular" });
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="container-page py-5">
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-white p-5">
        <SellerAvatar name={merchant.business_name} logoUrl={merchant.logo_url} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-navy">{merchant.business_name}</h1>
          {merchant.store_description ? <p className="mt-1 max-w-2xl text-sm text-graphite">{merchant.store_description}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mist">
            <span>
              {merchant.product_count} product{merchant.product_count === 1 ? "" : "s"}
            </span>
            <span>
              Selling since {new Date(merchant.created_at).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
            </span>
            <span className="flex items-center gap-1 font-semibold text-teal-700">
              <PackageCheck className="size-3.5" /> Fulfilled by BNP
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {result.products.map((p) => (
          <ProductTile key={p.id} product={p} className="shadow-sm" />
        ))}
      </div>

      {pages > 1 ? (
        <nav className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="Pages">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`${base}/seller/${merchant.slug}?page=${n}`}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-md text-sm font-semibold",
                n === page ? "bg-navy text-white" : "bg-white text-graphite hover:bg-stone",
              )}
            >
              {n}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
