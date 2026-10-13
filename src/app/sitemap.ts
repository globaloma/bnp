import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/public";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

// Rebuilt at most hourly, so new stores and products appear without a deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Same public views the storefront reads, so only active stores and
  // published products are ever listed.
  const supabase = createClient();
  const [{ data: stores }, { data: products }] = await Promise.all([
    supabase.from("storefront_partners").select("id, slug"),
    supabase.from("storefront_products").select("id, partner_id, image_url"),
  ]);

  const slugById = new Map((stores ?? []).map((s) => [s.id as string, s.slug as string]));

  for (const store of stores ?? []) {
    pages.push({
      url: `${SITE_URL}/store/${store.slug}`,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  for (const product of products ?? []) {
    const slug = slugById.get(product.partner_id);
    if (!slug) continue;
    pages.push({
      url: `${SITE_URL}/store/${slug}/p/${product.id}`,
      changeFrequency: "daily",
      priority: 0.6,
      ...(product.image_url ? { images: [product.image_url] } : {}),
    });
  }

  return pages;
}
