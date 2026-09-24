import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/public";
import { ProductCard } from "@/components/store/product-card";
import type { StorefrontPartner, StorefrontProduct } from "@/types/db";

export async function generateMetadata({
  params,
}: PageProps<"/store/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createClient();
  const { data: partner } = await supabase
    .from("storefront_partners")
    .select("business_name")
    .eq("slug", slug)
    .maybeSingle<Pick<StorefrontPartner, "business_name">>();

  return { title: partner ? partner.business_name : "Store" };
}

export default async function StorePage({ params }: PageProps<"/store/[slug]">) {
  const { slug } = await params;
  const supabase = createClient();

  const { data: partner } = await supabase
    .from("storefront_partners")
    .select("id, slug, business_name, category")
    .eq("slug", slug)
    .maybeSingle<StorefrontPartner>();

  if (!partner) notFound();

  const { data: products } = await supabase
    .from("storefront_products")
    .select(
      "id, partner_id, name, sku, category, sale_price, vat, stock, location, shipping_fee, pickup_enabled, image_url",
    )
    .eq("partner_id", partner.id)
    .returns<StorefrontProduct[]>();

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-semibold text-navy">{partner.business_name}</h1>
      {partner.category ? (
        <p className="mt-1 text-sm text-mist">{partner.category}</p>
      ) : null}

      {!products || products.length === 0 ? (
        <p className="mt-10 text-center text-sm text-mist">
          This store has no products available right now.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
