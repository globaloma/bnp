import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { listCategories, PAGE_SIZE, searchProducts, type SearchParams } from "@/lib/marketplace/data";
import { getShopBase } from "@/lib/marketplace/shop";
import { ProductTile } from "@/components/marketplace/product-tile";
import { SortSelect } from "@/components/marketplace/sort-select";
import { cn } from "@/lib/utils";

type Raw = Record<string, string | string[] | undefined>;

const SORTS = ["popular", "newest", "price_asc", "price_desc", "rating"] as const;

function read(raw: Raw): SearchParams {
  const one = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const num = (k: string) => {
    const v = Number(one(k));
    return one(k) && Number.isFinite(v) && v >= 0 ? v : undefined;
  };
  const sort = one("sort");
  return {
    q: one("q")?.slice(0, 100),
    category: one("category")?.slice(0, 80),
    seller: one("seller")?.slice(0, 80),
    min: num("min"),
    max: num("max"),
    sort: SORTS.includes(sort as (typeof SORTS)[number]) ? (sort as SearchParams["sort"]) : "popular",
    deals: one("deals") === "1",
    inStock: one("stock") === "1",
    page: Math.min(200, Math.max(1, Math.floor(num("page") ?? 1))),
  };
}

function heading(p: SearchParams) {
  if (p.q) return `Results for "${p.q}"`;
  if (p.deals) return "Deals";
  if (p.category) return p.category;
  if (p.sort === "newest") return "New arrivals";
  return "All products";
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Raw> }): Promise<Metadata> {
  return { title: heading(read(await searchParams)) };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const raw = await searchParams;
  const p = read(raw);
  const [base, categories, result] = await Promise.all([getShopBase(), listCategories(), searchProducts(p)]);
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  /** This search with some parameters changed, as a link. */
  const withParams = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && v) next.set(k, v);
    next.delete("page");
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return `${base}/search${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="container-page py-5">
      <nav className="mb-3 text-xs text-mist" aria-label="Breadcrumb">
        <Link href={base || "/"} className="hover:text-teal-700">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-graphite">{heading(p)}</span>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        <aside className="h-fit rounded-lg bg-white p-4 text-sm">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-mist uppercase">Category</p>
          <ul className="mt-2 flex max-h-72 flex-col overflow-y-auto">
            <li>
              <Link
                href={withParams({ category: undefined })}
                className={cn("block rounded px-2 py-1 hover:bg-cream", !p.category ? "font-semibold text-navy" : "text-graphite")}
              >
                All categories
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.name}>
                <Link
                  href={withParams({ category: c.name })}
                  className={cn(
                    "flex justify-between rounded px-2 py-1 hover:bg-cream",
                    p.category?.toLowerCase() === c.name.toLowerCase() ? "font-semibold text-navy" : "text-graphite",
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-[11px] text-mist">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>

          <form action={`${base}/search`} className="mt-5 border-t border-stone pt-4">
            {Object.entries(raw).map(([k, v]) =>
              typeof v === "string" && !["min", "max", "page", "stock", "deals"].includes(k) ? (
                <input key={k} type="hidden" name={k} value={v} />
              ) : null,
            )}
            <p className="text-[11px] font-semibold tracking-[0.08em] text-mist uppercase">Price (₦)</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                name="min"
                type="number"
                min="0"
                defaultValue={p.min}
                placeholder="Min"
                aria-label="Minimum price"
                className="h-9 w-full rounded-md border border-stone px-2 text-sm"
              />
              <span className="text-mist">to</span>
              <input
                name="max"
                type="number"
                min="0"
                defaultValue={p.max}
                placeholder="Max"
                aria-label="Maximum price"
                className="h-9 w-full rounded-md border border-stone px-2 text-sm"
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-graphite">
              <input type="checkbox" name="stock" value="1" defaultChecked={p.inStock} className="accent-teal" />
              In stock only
            </label>
            <label className="mt-2 flex items-center gap-2 text-graphite">
              <input type="checkbox" name="deals" value="1" defaultChecked={p.deals} className="accent-teal" />
              On sale
            </label>
            <button type="submit" className="mt-3 h-9 w-full rounded-md bg-navy text-sm font-semibold text-white hover:bg-navy-600">
              Apply
            </button>
          </form>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3">
            <div>
              <h1 className="text-lg font-semibold text-navy">{heading(p)}</h1>
              <p className="text-xs text-mist">
                {result.total} product{result.total === 1 ? "" : "s"}
                {p.seller ? " from this seller" : ""}
              </p>
            </div>
            <SortSelect value={p.sort ?? "popular"} />
          </div>

          {result.products.length === 0 ? (
            <div className="mt-4 flex flex-col items-center rounded-lg bg-white px-6 py-14 text-center">
              <SearchX className="size-10 text-mist" />
              <p className="mt-3 text-base font-semibold text-navy">Nothing matches that yet</p>
              <p className="mt-1 text-sm text-graphite">Try fewer words, another category, or a wider price range.</p>
              <Link href={`${base}/search`} className="mt-4 text-sm font-semibold text-teal-700 hover:underline">
                See all products
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
              {result.products.map((product) => (
                <ProductTile key={product.id} product={product} className="shadow-sm" />
              ))}
            </div>
          )}

          {pages > 1 ? (
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pages">
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === pages || Math.abs(n - result.page) <= 2)
                .map((n, i, list) => (
                  <span key={n} className="flex items-center gap-1.5">
                    {i > 0 && n - list[i - 1] > 1 ? <span className="text-mist">...</span> : null}
                    <Link
                      href={withParams({ page: String(n) })}
                      aria-current={n === result.page ? "page" : undefined}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-md text-sm font-semibold",
                        n === result.page ? "bg-navy text-white" : "bg-white text-graphite hover:bg-stone",
                      )}
                    >
                      {n}
                    </Link>
                  </span>
                ))}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
