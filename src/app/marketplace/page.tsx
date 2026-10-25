import Link from "next/link";
import { ArrowRight, BadgeCheck, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { homeSections, listCategories, type MarketProduct } from "@/lib/marketplace/data";
import { getShopBase } from "@/lib/marketplace/shop";
import { ProductTile } from "@/components/marketplace/product-tile";
import { SellerAvatar } from "@/components/marketplace/seller-avatar";

export const dynamic = "force-dynamic";

function Row({ title, more, products, accent }: { title: string; more: string; products: MarketProduct[]; accent?: boolean }) {
  if (products.length === 0) return null;
  return (
    <section className="mt-6 overflow-hidden rounded-lg bg-white">
      <div className={accent ? "flex items-center justify-between bg-destructive px-4 py-2.5 text-white" : "flex items-center justify-between border-b border-stone px-4 py-2.5"}>
        <h2 className={accent ? "text-base font-semibold" : "text-base font-semibold text-navy"}>{title}</h2>
        <Link href={more} className={accent ? "flex items-center gap-1 text-xs font-semibold uppercase hover:underline" : "flex items-center gap-1 text-xs font-semibold text-teal-700 uppercase hover:underline"}>
          See all <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 border-t border-l border-stone/70 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {products.map((p) => (
          <ProductTile key={p.id} product={p} className="rounded-none border-r border-b border-stone/70" />
        ))}
      </div>
    </section>
  );
}

export default async function MarketplaceHome() {
  const [base, sections, categories] = await Promise.all([getShopBase(), homeSections(), listCategories()]);
  const link = (path: string) => `${base}${path}`;
  const empty = sections.best.length === 0 && sections.newest.length === 0;

  return (
    <div className="container-page py-5">
      <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
        <aside className="hidden rounded-lg bg-white p-2 lg:block">
          <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-[0.08em] text-mist uppercase">Categories</p>
          <ul className="flex flex-col">
            {categories.slice(0, 12).map((c) => (
              <li key={c.name}>
                <Link
                  href={link(`/search?category=${encodeURIComponent(c.name)}`)}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-graphite hover:bg-cream hover:text-navy"
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-[11px] text-mist">{c.count}</span>
                </Link>
              </li>
            ))}
            <li>
              <Link href={link("/search")} className="block rounded px-2 py-1.5 text-sm font-semibold text-teal-700 hover:bg-cream">
                Everything
              </Link>
            </li>
          </ul>
        </aside>

        <div className="relative overflow-hidden rounded-lg bg-navy px-6 py-8 text-white sm:px-10 sm:py-12">
          <div className="absolute -top-16 -right-16 size-64 rounded-full bg-teal/30" aria-hidden />
          <div className="absolute -right-6 -bottom-20 size-48 rounded-full bg-gold/25" aria-hidden />
          <div className="relative max-w-lg">
            <p className="text-xs font-semibold tracking-[0.14em] text-gold uppercase">Nigerian brands, one cart</p>
            <h1 className="mt-2 text-3xl leading-tight font-bold sm:text-4xl">Shop from local brands. We pack and deliver.</h1>
            <p className="mt-3 text-sm text-white/80 sm:text-base">
              Every product here is already in a BNP warehouse, so your order is checked, packed and on its way fast.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={link("/search")} className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-navy hover:bg-gold-300">
                Start shopping
              </Link>
              <Link href={link("/search?deals=1")} className="rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">
                Today&apos;s deals
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-white p-3 text-xs text-graphite sm:grid-cols-4 sm:p-4">
        {[
          { icon: PackageCheck, title: "Fulfilled by BNP", text: "Checked and packed in our warehouse" },
          { icon: Truck, title: "Fast delivery", text: "Abuja, Lagos and nationwide" },
          { icon: ShieldCheck, title: "Secure payment", text: "Card, transfer or USSD by Paystack" },
          { icon: BadgeCheck, title: "Real reviews", text: "Only from customers who received it" },
        ].map((f) => (
          <div key={f.title} className="flex items-start gap-2.5">
            <f.icon className="mt-0.5 size-5 shrink-0 text-teal" />
            <span>
              <span className="block font-semibold text-navy">{f.title}</span>
              {f.text}
            </span>
          </div>
        ))}
      </div>

      {empty ? (
        <div className="mt-6 rounded-lg bg-white px-6 py-12 text-center">
          <p className="text-base font-semibold text-navy">The shop is filling up</p>
          <p className="mt-1 text-sm text-graphite">Products appear here as our merchants publish them. Check back soon.</p>
        </div>
      ) : null}

      <Row title="Deals" more={link("/search?deals=1")} products={sections.deals} accent />
      <Row title="Best sellers" more={link("/search")} products={sections.best} />
      <Row title="New arrivals" more={link("/search?sort=newest")} products={sections.newest} />

      {sections.merchants.length > 0 ? (
        <section className="mt-6 rounded-lg bg-white">
          <div className="flex items-center justify-between border-b border-stone px-4 py-2.5">
            <h2 className="text-base font-semibold text-navy">Shop by seller</h2>
            <Link href={link("/sellers")} className="flex items-center gap-1 text-xs font-semibold text-teal-700 uppercase hover:underline">
              All sellers <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
            {sections.merchants.map((m) => (
              <Link
                key={m.id}
                href={link(`/seller/${m.slug}`)}
                className="flex flex-col items-center gap-2 rounded-lg border border-stone p-3 text-center transition-colors hover:border-teal/50"
              >
                <SellerAvatar name={m.business_name} logoUrl={m.logo_url} />
                <span className="line-clamp-2 text-xs font-semibold text-navy">{m.business_name}</span>
                <span className="text-[11px] text-mist">
                  {m.product_count} product{m.product_count === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
