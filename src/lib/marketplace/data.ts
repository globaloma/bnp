import "server-only";
import { createClient } from "@/lib/supabase/public";
import type { WarehouseLocation } from "@/types/db";

// Reads for the customer marketplace, from the public marketplace_products /
// marketplace_merchants views (migration 0033). Anonymous: no session needed.

export type MarketProduct = {
  id: string;
  partner_id: string;
  name: string;
  category: string | null;
  sale_price: number;
  promo_price: number | null;
  /** What the customer pays per unit: the promo price while there is one. */
  price: number;
  vat: number;
  stock: number;
  location: WarehouseLocation;
  image_url: string | null;
  description: string | null;
  variant: string | null;
  group_id: string | null;
  weight_kg: number;
  created_at: string;
  merchant_slug: string;
  merchant_name: string;
  merchant_logo: string | null;
  rating_avg: number;
  rating_count: number;
  sold_90d: number;
};

export type MarketMerchant = {
  id: string;
  slug: string;
  business_name: string;
  logo_url: string | null;
  store_description: string | null;
  category: string | null;
  created_at: string;
  product_count: number;
};

export type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  body: string | null;
  created_at: string;
};

const COLUMNS =
  "id, partner_id, name, category, sale_price, promo_price, price, vat, stock, location, image_url, description, variant, group_id, weight_kg, created_at, merchant_slug, merchant_name, merchant_logo, rating_avg, rating_count, sold_90d";

export const PAGE_SIZE = 24;

function normalise(rows: MarketProduct[] | null): MarketProduct[] {
  return (rows ?? []).map((p) => ({
    ...p,
    sale_price: Number(p.sale_price),
    promo_price: p.promo_price === null ? null : Number(p.promo_price),
    price: Number(p.price),
    vat: Number(p.vat),
    weight_kg: Number(p.weight_kg),
    rating_avg: Number(p.rating_avg),
  }));
}

/** One card per product: colours and sizes of the same product collapse to the first in stock. */
export function onePerGroup(products: MarketProduct[]): MarketProduct[] {
  const seen = new Map<string, MarketProduct>();
  for (const p of products) {
    const key = p.group_id ?? p.id;
    const kept = seen.get(key);
    if (!kept || (kept.stock <= 0 && p.stock > 0)) seen.set(key, p);
  }
  return [...seen.values()];
}

/** Categories in the shop with how many products each has, biggest first. */
export async function listCategories(): Promise<{ name: string; count: number }[]> {
  const { data } = await createClient().from("marketplace_products").select("category").limit(10000);
  const counts = new Map<string, { name: string; count: number }>();
  for (const row of data ?? []) {
    const name = (row.category as string | null)?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = counts.get(key) ?? { name, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function homeSections() {
  const supabase = createClient();
  const base = () => supabase.from("marketplace_products").select(COLUMNS).gt("stock", 0);
  const [deals, best, newest, merchants] = await Promise.all([
    base().not("promo_price", "is", null).order("created_at", { ascending: false }).limit(24),
    base().order("sold_90d", { ascending: false }).order("rating_avg", { ascending: false }).limit(24),
    base().order("created_at", { ascending: false }).limit(24),
    supabase.from("marketplace_merchants").select("*").order("product_count", { ascending: false }).limit(12),
  ]);
  return {
    deals: onePerGroup(normalise(deals.data as MarketProduct[] | null)).slice(0, 10),
    best: onePerGroup(normalise(best.data as MarketProduct[] | null)).slice(0, 10),
    newest: onePerGroup(normalise(newest.data as MarketProduct[] | null)).slice(0, 10),
    merchants: (merchants.data ?? []) as MarketMerchant[],
  };
}

export type SearchParams = {
  q?: string;
  category?: string;
  seller?: string;
  min?: number;
  max?: number;
  sort?: "popular" | "newest" | "price_asc" | "price_desc" | "rating";
  deals?: boolean;
  inStock?: boolean;
  page?: number;
};

/** Words for an ilike filter, with the characters PostgREST filters treat specially removed. */
function safeTerm(q: string) {
  return q.replace(/[%_,()*:\\."']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function searchProducts(params: SearchParams) {
  const page = Math.max(1, params.page ?? 1);
  let query = createClient().from("marketplace_products").select(COLUMNS, { count: "exact" });

  const term = params.q ? safeTerm(params.q) : "";
  if (term) {
    for (const word of term.split(" ").slice(0, 5)) {
      query = query.or(`name.ilike.%${word}%,category.ilike.%${word}%,merchant_name.ilike.%${word}%,description.ilike.%${word}%`);
    }
  }
  if (params.category) query = query.ilike("category", safeTerm(params.category));
  if (params.seller) query = query.eq("merchant_slug", params.seller);
  if (params.min !== undefined) query = query.gte("price", params.min);
  if (params.max !== undefined) query = query.lte("price", params.max);
  if (params.deals) query = query.not("promo_price", "is", null);
  if (params.inStock) query = query.gt("stock", 0);

  switch (params.sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "rating":
      query = query.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false });
      break;
    default:
      query = query.order("sold_90d", { ascending: false }).order("created_at", { ascending: false });
  }
  query = query.order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count } = await query;
  return { products: normalise(data as MarketProduct[] | null), total: count ?? 0, page };
}

export async function getProduct(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = createClient();
  const { data } = await supabase.from("marketplace_products").select(COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const [product] = normalise([data as MarketProduct]);

  const [variants, reviews, fromSeller, similar] = await Promise.all([
    product.group_id
      ? supabase.from("marketplace_products").select(COLUMNS).eq("group_id", product.group_id)
      : Promise.resolve({ data: [data] }),
    supabase
      .from("product_reviews")
      .select("id, reviewer_name, rating, body, created_at")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("marketplace_products")
      .select(COLUMNS)
      .eq("partner_id", product.partner_id)
      .neq("id", product.id)
      .gt("stock", 0)
      .order("sold_90d", { ascending: false })
      .limit(16),
    product.category
      ? supabase
          .from("marketplace_products")
          .select(COLUMNS)
          .ilike("category", product.category)
          .neq("partner_id", product.partner_id)
          .gt("stock", 0)
          .order("sold_90d", { ascending: false })
          .limit(16)
      : Promise.resolve({ data: [] }),
  ]);

  const sameGroup = (p: MarketProduct) => product.group_id !== null && p.group_id === product.group_id;
  return {
    product,
    variants: normalise(variants.data as MarketProduct[] | null).sort((a, b) =>
      (a.variant ?? "").localeCompare(b.variant ?? ""),
    ),
    reviews: (reviews.data ?? []) as Review[],
    fromSeller: onePerGroup(normalise(fromSeller.data as MarketProduct[] | null).filter((p) => !sameGroup(p))).slice(0, 5),
    similar: onePerGroup(normalise(similar.data as MarketProduct[] | null)).slice(0, 5),
  };
}

export async function getMerchant(slug: string): Promise<MarketMerchant | null> {
  const { data } = await createClient().from("marketplace_merchants").select("*").eq("slug", slug).maybeSingle();
  return (data as MarketMerchant | null) ?? null;
}

/** Products by id, for refreshing a cart's prices and stock. */
export async function productsById(ids: string[]): Promise<MarketProduct[]> {
  if (ids.length === 0) return [];
  const { data } = await createClient().from("marketplace_products").select(COLUMNS).in("id", ids.slice(0, 200));
  return normalise(data as MarketProduct[] | null);
}
