import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, MapPin, PackageCheck, RotateCcw, Store, Truck } from "lucide-react";
import { getProduct } from "@/lib/marketplace/data";
import { getShopBase, getShopOrigin } from "@/lib/marketplace/shop";
import { getCustomer } from "@/lib/marketplace/customer";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/variants";
import { LOW_STOCK_THRESHOLD } from "@/types/db";
import { Stars } from "@/components/marketplace/stars";
import { ProductTile } from "@/components/marketplace/product-tile";
import { discountPercent } from "@/lib/marketplace/pricing";
import { BuyBox } from "@/components/marketplace/buy-box";
import { ReviewForm } from "@/components/marketplace/review-form";
import { SellerAvatar } from "@/components/marketplace/seller-avatar";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const found = await getProduct(id);
  if (!found) return { title: "Product" };
  const { product } = found;
  const description =
    product.description?.slice(0, 160) ?? `${displayName(product)} from ${product.merchant_name}, ${naira(product.price)}.`;
  const images = product.image_url ? [{ url: product.image_url }] : undefined;
  return {
    title: displayName(product),
    description,
    openGraph: { title: `${displayName(product)} · ${naira(product.price)}`, description, images, siteName: "BNP Shop" },
    twitter: { card: "summary_large_image", title: displayName(product), description, images },
  };
}

export default async function MarketProductPage({ params }: Props) {
  const { id } = await params;
  const [found, base, origin, customer] = await Promise.all([getProduct(id), getShopBase(), getShopOrigin(), getCustomer()]);
  if (!found) notFound();
  const { product, variants, reviews, fromSeller, similar } = found;
  const link = (path: string) => `${base}${path}`;
  const off = discountPercent(product);

  // Signed-in shopper: wishlist state, and whether they can review it.
  let wished = false;
  let canReview = false;
  let myReview: { rating: number; body: string | null } | null = null;
  if (customer) {
    const supabase = await createClient();
    const [{ data: w }, { data: delivered }, { data: mine }] = await Promise.all([
      supabase.from("wishlist_items").select("product_id").eq("product_id", product.id).maybeSingle(),
      supabase.from("orders").select("id").eq("product_id", product.id).eq("status", "Delivered").limit(1),
      supabase.from("product_reviews").select("rating, body").eq("product_id", product.id).eq("customer_id", customer.id).maybeSingle(),
    ]);
    wished = Boolean(w);
    canReview = (delivered ?? []).length > 0;
    myReview = mine ?? null;
  }

  const stock =
    product.stock <= 0
      ? { text: "Sold out", tone: "text-destructive" }
      : product.stock <= LOW_STOCK_THRESHOLD
        ? { text: `Only ${product.stock} left`, tone: "text-gold" }
        : { text: "In stock", tone: "text-success" };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: displayName(product),
    ...(product.description ? { description: product.description } : {}),
    ...(product.image_url ? { image: [product.image_url] } : {}),
    ...(product.category ? { category: product.category } : {}),
    brand: { "@type": "Brand", name: product.merchant_name },
    ...(product.rating_count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating_avg, reviewCount: product.rating_count } }
      : {}),
    offers: {
      "@type": "Offer",
      url: `${origin}/p/${product.id}`,
      priceCurrency: "NGN",
      price: product.price.toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: product.merchant_name },
    },
  };

  return (
    <div className="container-page py-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <nav className="mb-3 flex flex-wrap text-xs text-mist" aria-label="Breadcrumb">
        <Link href={base || "/"} className="hover:text-teal-700">
          Home
        </Link>
        {product.category ? (
          <>
            <span className="mx-1.5">/</span>
            <Link href={link(`/search?category=${encodeURIComponent(product.category)}`)} className="hover:text-teal-700">
              {product.category}
            </Link>
          </>
        ) : null}
        <span className="mx-1.5">/</span>
        <span className="truncate text-graphite">{product.name}</span>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="grid gap-6 rounded-lg bg-white p-4 sm:p-6 md:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-stone/60">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center">
                <Boxes className="size-16 text-mist" />
              </span>
            )}
            {off > 0 ? (
              <span className="absolute top-3 left-3 rounded bg-gold px-2 py-0.5 text-sm font-bold text-navy">-{off}%</span>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col">
            <Link
              href={link(`/seller/${product.merchant_slug}`)}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              {product.merchant_name}
            </Link>
            <h1 className="mt-1 text-xl leading-snug font-semibold text-navy sm:text-2xl">{product.name}</h1>
            {product.rating_count > 0 ? (
              <a href="#reviews" className="mt-1.5 w-fit">
                <Stars rating={product.rating_avg} count={product.rating_count} size="md" />
              </a>
            ) : (
              <p className="mt-1.5 text-xs text-mist">No reviews yet</p>
            )}

            <div className="mt-4 border-t border-stone pt-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-3xl font-bold text-navy">{naira(product.price)}</span>
                {off > 0 ? (
                  <>
                    <span className="text-base text-mist line-through">{naira(product.sale_price)}</span>
                    <span className="rounded bg-gold/20 px-1.5 py-0.5 text-xs font-bold text-navy">-{off}%</span>
                  </>
                ) : null}
              </div>
              <p className={cn("mt-1 text-sm font-semibold", stock.tone)}>{stock.text}</p>
              {product.vat > 0 ? <p className="mt-0.5 text-xs text-mist">+ {product.vat}% VAT, added at checkout</p> : null}
            </div>

            {variants.length > 1 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold tracking-[0.08em] text-graphite uppercase">Options</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <Link
                      key={v.id}
                      href={link(`/p/${v.id}`)}
                      aria-current={v.id === product.id ? "true" : undefined}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm transition-colors",
                        v.id === product.id ? "border-navy bg-navy text-white" : "border-stone text-graphite hover:border-teal/50",
                        v.stock <= 0 && v.id !== product.id && "text-mist line-through",
                      )}
                    >
                      {v.variant ?? v.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : product.variant ? (
              <p className="mt-3 text-sm text-graphite">{product.variant}</p>
            ) : null}

            <BuyBox product={product} wished={wished} signedIn={Boolean(customer)} />
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-lg bg-white p-4 text-sm">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-mist uppercase">Delivery and returns</p>
            <ul className="mt-3 flex flex-col gap-3 text-graphite">
              <li className="flex gap-2.5">
                <PackageCheck className="mt-0.5 size-4 shrink-0 text-teal" />
                <span>
                  <span className="font-semibold text-navy">Fulfilled by BNP.</span> Stored, checked and packed in our {product.location}{" "}
                  warehouse.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Truck className="mt-0.5 size-4 shrink-0 text-teal" />
                Delivery fee is worked out at checkout from your area and the parcel weight.
              </li>
              {product.location === "Abuja" ? (
                <li className="flex gap-2.5">
                  <Store className="mt-0.5 size-4 shrink-0 text-teal" />
                  Free pickup from our hub in Jabi, Abuja.
                </li>
              ) : null}
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-teal" />
                Ships from {product.location}.
              </li>
              <li className="flex gap-2.5">
                <RotateCcw className="mt-0.5 size-4 shrink-0 text-teal" />
                Wrong or damaged item? Contact us from your order and we&apos;ll make it right.
              </li>
            </ul>
          </div>
          <Link
            href={link(`/seller/${product.merchant_slug}`)}
            className="flex items-center gap-3 rounded-lg bg-white p-4 transition-colors hover:bg-white/70"
          >
            <SellerAvatar name={product.merchant_name} logoUrl={product.merchant_logo} />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold tracking-[0.08em] text-mist uppercase">Sold by</span>
              <span className="block truncate text-sm font-semibold text-navy">{product.merchant_name}</span>
              <span className="text-xs text-teal-700">See all their products</span>
            </span>
          </Link>
        </aside>
      </div>

      {product.description ? (
        <section className="mt-4 rounded-lg bg-white p-4 sm:p-6">
          <h2 className="text-base font-semibold text-navy">Product details</h2>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-graphite">{product.description}</p>
        </section>
      ) : null}

      <section id="reviews" className="mt-4 scroll-mt-32 rounded-lg bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-navy">Customer reviews</h2>
          {product.rating_count > 0 ? (
            <span className="flex items-center gap-2 text-sm text-graphite">
              <Stars rating={product.rating_avg} size="md" />
              {product.rating_avg.toFixed(1)} out of 5, {product.rating_count} review{product.rating_count === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        {canReview ? (
          <ReviewForm productId={product.id} existing={myReview} />
        ) : (
          <p className="mt-2 text-xs text-mist">Only customers who received this product can review it.</p>
        )}
        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-graphite">No reviews yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone">
            {reviews.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-center gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-xs font-semibold text-navy">{r.reviewer_name}</span>
                  <span className="text-[11px] text-mist">
                    {new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="text-[11px] font-semibold text-success">Verified purchase</span>
                </div>
                {r.body ? <p className="mt-1 text-sm whitespace-pre-line text-graphite">{r.body}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {fromSeller.length > 0 ? (
        <section className="mt-4 rounded-lg bg-white">
          <h2 className="border-b border-stone px-4 py-2.5 text-base font-semibold text-navy">More from {product.merchant_name}</h2>
          <div className="grid grid-cols-2 border-t border-l border-stone/70 sm:grid-cols-3 lg:grid-cols-5">
            {fromSeller.map((p) => (
              <ProductTile key={p.id} product={p} className="rounded-none border-r border-b border-stone/70" />
            ))}
          </div>
        </section>
      ) : null}
      {similar.length > 0 ? (
        <section className="mt-4 rounded-lg bg-white">
          <h2 className="border-b border-stone px-4 py-2.5 text-base font-semibold text-navy">You may also like</h2>
          <div className="grid grid-cols-2 border-t border-l border-stone/70 sm:grid-cols-3 lg:grid-cols-5">
            {similar.map((p) => (
              <ProductTile key={p.id} product={p} className="rounded-none border-r border-b border-stone/70" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
