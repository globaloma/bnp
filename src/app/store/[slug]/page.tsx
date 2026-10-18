import type { Metadata } from "next";
import { AtSign, MessageCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/public";
import { ProductCard } from "@/components/store/product-card";
import { groupVariants } from "@/lib/variants";
import { StoreAvatar } from "@/components/store/store-avatar";
import { whatsappLink } from "@/lib/format";
import type { StorefrontPartner, StorefrontProduct } from "@/types/db";

export async function generateMetadata({
  params,
}: PageProps<"/store/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createClient();
  const { data: partner } = await supabase
    .from("storefront_partners")
    .select("business_name, category, logo_url, store_description")
    .eq("slug", slug)
    .maybeSingle<
      Pick<StorefrontPartner, "business_name" | "category" | "logo_url" | "store_description">
    >();

  if (!partner) return { title: "Store" };

  const description =
    partner.store_description ??
    `Shop ${partner.business_name}${partner.category ? `, ${partner.category.toLowerCase()}` : ""}, delivered by BNP Fulfillment.`;

  // A page that sets its own openGraph loses the root default image, so
  // fall back to it explicitly when the store has no logo.
  const images = partner.logo_url
    ? [{ url: partner.logo_url }]
    : [{ url: "/opengraph-image", width: 1200, height: 630 }];

  return {
    title: partner.business_name,
    description,
    alternates: { canonical: `/store/${slug}` },
    openGraph: {
      title: partner.business_name,
      description,
      url: `/store/${slug}`,
      images,
    },
    twitter: {
      // A square logo reads better as a small card than stretched wide.
      card: partner.logo_url ? "summary" : "summary_large_image",
      title: partner.business_name,
      description,
      images,
    },
  };
}

export default async function StorePage({ params }: PageProps<"/store/[slug]">) {
  const { slug } = await params;
  const supabase = createClient();

  const { data: partner } = await supabase
    .from("storefront_partners")
    .select(
      "id, slug, business_name, category, charges_vat, logo_url, store_description, store_whatsapp, store_instagram",
    )
    .eq("slug", slug)
    .maybeSingle<StorefrontPartner>();

  if (!partner) notFound();

  const { data: rawProducts } = await supabase
    .from("storefront_products")
    .select(
      "id, partner_id, name, sku, category, sale_price, vat, stock, location, shipping_fee, pickup_enabled, image_url, description, variant, group_id",
    )
    .eq("partner_id", partner.id)
    .returns<StorefrontProduct[]>();

  // This merchant's VAT preference applies across their whole storefront -
  // zeroing it here means the cart/checkout UI (which reads vat off each
  // cart item) never shows or charges VAT for them, with no extra plumbing.
  const products = rawProducts?.map((p) => ({
    ...p,
    vat: partner.charges_vat ? p.vat : 0,
  }));

  return (
    <div className="container-page py-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-stone bg-white p-5 sm:flex-row sm:items-center sm:p-6">
        <StoreAvatar name={partner.business_name} logoUrl={partner.logo_url} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-navy">{partner.business_name}</h1>
          {partner.category ? (
            <p className="mt-0.5 text-sm text-mist">{partner.category}</p>
          ) : null}
          {partner.store_description ? (
            <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-graphite">
              {partner.store_description}
            </p>
          ) : null}
        </div>
        {partner.store_whatsapp || partner.store_instagram ? (
          <div className="flex flex-wrap gap-2 sm:flex-col">
            {partner.store_whatsapp ? (
              <a
                href={whatsappLink(
                  partner.store_whatsapp,
                  `Hi ${partner.business_name}, I have a question about your store.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <MessageCircle className="size-4" />
                Chat on WhatsApp
              </a>
            ) : null}
            {partner.store_instagram ? (
              <a
                href={`https://instagram.com/${partner.store_instagram}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-stone px-4 text-sm font-semibold text-navy transition-colors hover:border-teal hover:text-teal-700"
              >
                <AtSign className="size-4" />
                {partner.store_instagram}
              </a>
            ) : null}
          </div>
        ) : null}
      </section>

      {!products || products.length === 0 ? (
        <p className="mt-10 text-center text-sm text-mist">
          This store has no products available right now.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {groupVariants(products).map((variants) => (
            <ProductCard key={variants[0].id} variants={variants} slug={partner.slug} />
          ))}
        </div>
      )}
    </div>
  );
}
