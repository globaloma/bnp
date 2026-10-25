import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { productsById } from "@/lib/marketplace/data";
import { getShopBase } from "@/lib/marketplace/shop";
import { ProductTile } from "@/components/marketplace/product-tile";

export const metadata: Metadata = { title: "Saved items" };

export default async function SavedPage() {
  const [base, supabase] = await Promise.all([getShopBase(), createClient()]);
  const { data } = await supabase.from("wishlist_items").select("product_id").order("created_at", { ascending: false });
  const ids = (data ?? []).map((r) => r.product_id as string);
  const products = await productsById(ids);
  const ordered = ids.flatMap((id) => products.filter((p) => p.id === id));

  return (
    <div className="rounded-lg bg-white">
      <h1 className="border-b border-stone px-4 py-3 text-lg font-semibold text-navy">Saved items ({ordered.length})</h1>
      {ordered.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <Heart className="size-10 text-mist" />
          <p className="mt-3 font-semibold text-navy">Nothing saved yet</p>
          <p className="mt-1 text-sm text-graphite">Tap the heart on a product to keep it here for later.</p>
          <Link href={base || "/"} className="mt-3 text-sm font-semibold text-teal-700 hover:underline">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 border-t border-l border-stone/70 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((p) => (
            <ProductTile key={p.id} product={p} className="rounded-none border-r border-b border-stone/70" />
          ))}
        </div>
      )}
    </div>
  );
}
