import { onPromo, unitPrice } from "@/lib/product-price";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, MapPin, Store, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/public";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddToCart } from "@/components/store/add-to-cart";
import { ProductCard } from "@/components/store/product-card";
import { groupVariants } from "@/lib/variants";
import { ShareProduct } from "@/components/store/share-product";
import { LOW_STOCK_THRESHOLD } from "@/types/db";
import type { StorefrontPartner, StorefrontProduct } from "@/types/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRODUCT_COLUMNS =
  "id, partner_id, name, sku, category, sale_price, promo_price, vat, stock, location, shipping_fee, pickup_enabled, image_url, description, variant, group_id";

async function loadProduct(slug: string, productId: string) {
  if (!UUID.test(productId)) return null;

  const supabase = createClient();
  const { data: partner } = await supabase
    .from("storefront_partners")
    .select("id, slug, business_name, charges_vat")
    .eq("slug", slug)
    .maybeSingle<Pick<StorefrontPartner, "id" | "slug" | "business_name" | "charges_vat">>();
  if (!partner) return null;

  const { data: product } = await supabase
    .from("storefront_products")
    .select(PRODUCT_COLUMNS)
    .eq("id", productId)
    .eq("partner_id", partner.id)
    .maybeSingle<StorefrontProduct>();
  if (!product) return null;

  // Same rule as the store page: merchants who don't charge VAT never show it.
  const withVat = (p: StorefrontProduct) => ({ ...p, vat: partner.charges_vat ? p.vat : 0 });
  return { supabase, partner, product: withVat(product), withVat };
}

export async function generateMetadata({
  params,
}: PageProps<"/store/[slug]/p/[productId]">): Promise<Metadata> {
  const { slug, productId } = await params;
  const loaded = await loadProduct(slug, productId);
  if (!loaded) return { title: "Product" };

  const { partner, product } = loaded;
  const description =
    product.description?.slice(0, 160) ??
    `${product.name} from ${partner.business_name}, ${naira(unitPrice(product))}.`;

  // Falls back to the site default, which a page-level openGraph would
  // otherwise drop.
  const images = product.image_url
    ? [{ url: product.image_url }]
    : [{ url: "/opengraph-image", width: 1200, height: 630 }];
  const path = `/store/${partner.slug}/p/${product.id}`;

  return {
    title: `${product.name} · ${partner.business_name}`,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${product.name} · ${naira(unitPrice(product))}`,
      description,
      url: path,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} · ${naira(unitPrice(product))}`,
      description,
      images,
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/store/[slug]/p/[productId]">) {
  const { slug, productId } = await params;
  const loaded = await loadProduct(slug, productId);
  if (!loaded) notFound();

  const { supabase, partner, product, withVat } = loaded;

  const { data: others } = await supabase
    .from("storefront_products")
    .select(PRODUCT_COLUMNS)
    .eq("partner_id", partner.id)
    .neq("id", product.id)
    .gt("stock", 0)
    .limit(24)
    .returns<StorefrontProduct[]>();
  const otherProducts = (others ?? []).map(withVat);
  // Every variant of this product, sold-out ones included, for the chooser.
  let siblings: StorefrontProduct[] = [product];
  if (product.group_id) {
    const { data: groupRows } = await supabase
      .from("storefront_products")
      .select(PRODUCT_COLUMNS)
      .eq("partner_id", partner.id)
      .eq("group_id", product.group_id)
      .returns<StorefrontProduct[]>();
    siblings = (groupRows ?? [product])
      .map(withVat)
      .sort((a, b) => (a.variant ?? "").localeCompare(b.variant ?? ""));
  }
  const moreProducts = groupVariants(
    otherProducts.filter((p) => !product.group_id || p.group_id !== product.group_id),
  ).slice(0, 4);

  const stockLabel =
    product.stock <= 0
      ? { text: "Out of stock", tone: "text-destructive" }
      : product.stock <= LOW_STOCK_THRESHOLD
        ? { text: `Only ${product.stock} left`, tone: "text-gold" }
        : { text: "In stock", tone: "text-success" };

  const productUrl = `${SITE_URL}/store/${partner.slug}/p/${product.id}`;

  // schema.org Product data, so search engines can show price and stock.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.image_url ? { image: [product.image_url] } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.category ? { category: product.category } : {}),
    brand: { "@type": "Brand", name: partner.business_name },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "NGN",
      price: unitPrice(product).toFixed(2),
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: partner.business_name },
    },
  };

  return (
    <div className="container-page py-6 sm:py-8">
      <script
        type="application/ld+json"
        // JSON.stringify output with "<" escaped, so product text can't close the tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <Link
        href={`/store/${partner.slug}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-graphite hover:text-teal-700"
      >
        <ArrowLeft className="size-4" />
        Back to {partner.business_name}
      </Link>

      <div className="mt-4 grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-stone bg-stone">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="size-full object-cover"
            />
          ) : (
            <Boxes className="size-16 text-mist" />
          )}
        </div>

        <div className="flex flex-col">
          {product.category ? (
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-700">
              {product.category}
            </p>
          ) : null}
          <h1 className="mt-1 text-2xl font-semibold text-navy sm:text-3xl">{product.name}</h1>
          {siblings.length > 1 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-graphite">Options</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {siblings.map((v) => (
                  <Link
                    key={v.id}
                    href={`/store/${partner.slug}/p/${v.id}`}
                    aria-current={v.id === product.id ? "true" : undefined}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                      v.id === product.id
                        ? "border-navy bg-navy text-white"
                        : "border-stone text-graphite hover:border-teal/40",
                      v.stock <= 0 && v.id !== product.id && "text-mist line-through",
                    )}
                  >
                    {v.variant ?? v.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : product.variant ? (
            <p className="mt-1 text-sm text-graphite">{product.variant}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold text-success">
              {naira(unitPrice(product))}
            </span>
            {onPromo(product) ? (
              <span className="text-base text-mist line-through">{naira(product.sale_price)}</span>
            ) : null}
            <span className={cn("text-sm font-semibold", stockLabel.tone)}>
              {stockLabel.text}
            </span>
          </div>
          {product.vat > 0 ? (
            <p className="mt-1 text-xs text-mist">+ {product.vat}% VAT, added at checkout</p>
          ) : null}

          <AddToCart product={product} size="lg" className="mt-6 sm:max-w-xs" />

          <ul className="mt-6 flex flex-col gap-2.5 text-sm text-graphite">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-teal" />
              Ships from our {product.location} warehouse
            </li>
            <li className="flex items-start gap-2.5">
              <Truck className="mt-0.5 size-4 shrink-0 text-teal" />
              Delivery fee is shown at checkout, based on where you are
            </li>
            {product.pickup_enabled ? (
              <li className="flex items-start gap-2.5">
                <Store className="mt-0.5 size-4 shrink-0 text-teal" />
                Free pickup available from {product.location}
              </li>
            ) : null}
          </ul>

          {product.description ? (
            <div className="mt-6 border-t border-stone pt-5">
              <h2 className="text-sm font-semibold text-navy">About this product</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-graphite">
                {product.description}
              </p>
            </div>
          ) : null}

          <ShareProduct url={productUrl} name={product.name} className="mt-6" />
        </div>
      </div>

      {moreProducts.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-navy">More from {partner.business_name}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {moreProducts.map((variants) => (
              <ProductCard key={variants[0].id} variants={variants} slug={partner.slug} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
