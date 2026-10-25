"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/store/cart-context";
import { LogoMark } from "@/components/marketing/logo";
import { useShopHref } from "./shop-base";

export function ShopHeader({
  categories,
  customerName,
}: {
  categories: { name: string; count: number }[];
  customerName: string | null;
}) {
  const href = useShopHref();
  const router = useRouter();
  const params = useSearchParams();
  const { count, hydrated } = useCart();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [menu, setMenu] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(href(term ? `/search?q=${encodeURIComponent(term)}` : "/search"));
  }

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="bg-navy text-[11px] text-white/80">
        <div className="container-page flex h-8 items-center justify-between gap-4">
          <span className="truncate">Every order packed and delivered by BNP Fulfillment</span>
          <Link href={href("/track")} className="shrink-0 font-semibold text-white hover:text-gold">
            Track your order
          </Link>
        </div>
      </div>

      <div className="container-page flex h-16 items-center gap-3 sm:gap-5">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="flex size-9 items-center justify-center rounded-md text-navy hover:bg-stone lg:hidden"
          aria-label={menu ? "Close categories" : "Open categories"}
          aria-expanded={menu}
        >
          {menu ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Link href={href("/")} className="flex shrink-0 items-center gap-2">
          <span className="size-8">
            <LogoMark />
          </span>
          <span className="hidden leading-none sm:block">
            <span className="block text-sm font-bold tracking-tight text-navy">BNP Shop</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">by BNP Fulfillment</span>
          </span>
        </Link>

        <form onSubmit={submit} role="search" className="flex min-w-0 flex-1">
          <label htmlFor="shop-search" className="sr-only">
            Search products, brands and categories
          </label>
          <input
            id="shop-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, brands and categories"
            className="h-10 min-w-0 flex-1 rounded-l-md border border-r-0 border-stone bg-white px-3 text-sm text-navy outline-none placeholder:text-mist focus-visible:border-teal"
          />
          <button
            type="submit"
            className="flex h-10 items-center gap-1.5 rounded-r-md bg-gold px-3 text-sm font-semibold text-navy hover:bg-gold-300 sm:px-5"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>

        <Link
          href={href(customerName ? "/account" : "/account/login")}
          className="hidden items-center gap-1.5 text-sm font-semibold text-navy hover:text-teal-700 md:flex"
        >
          <User className="size-5" />
          <span className="max-w-28 truncate">{customerName ? `Hi, ${customerName.split(" ")[0]}` : "Sign in"}</span>
        </Link>
        <Link
          href={href("/cart")}
          className="relative flex items-center gap-1.5 text-sm font-semibold text-navy hover:text-teal-700"
          aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
        >
          <ShoppingCart className="size-6" />
          <span className="hidden md:inline">Cart</span>
          {hydrated && count > 0 ? (
            <span className="absolute -top-1.5 left-3.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Link>
      </div>

      <nav
        aria-label="Categories"
        className={cn("border-t border-stone bg-white", menu ? "block" : "hidden lg:block")}
      >
        <div className="container-page flex flex-col gap-0.5 py-2 lg:flex-row lg:items-center lg:gap-1 lg:overflow-x-auto lg:py-0">
          <Link
            href={href("/search?deals=1")}
            onClick={() => setMenu(false)}
            className="rounded px-2.5 py-2 text-sm font-semibold whitespace-nowrap text-destructive hover:bg-stone/60 lg:text-[13px]"
          >
            Deals
          </Link>
          {categories.slice(0, 10).map((c) => (
            <Link
              key={c.name}
              href={href(`/search?category=${encodeURIComponent(c.name)}`)}
              onClick={() => setMenu(false)}
              className="rounded px-2.5 py-2 text-sm whitespace-nowrap text-graphite hover:bg-stone/60 hover:text-navy lg:text-[13px]"
            >
              {c.name}
            </Link>
          ))}
          <Link
            href={href(customerName ? "/account" : "/account/login")}
            onClick={() => setMenu(false)}
            className="rounded px-2.5 py-2 text-sm font-semibold text-navy hover:bg-stone/60 md:hidden"
          >
            {customerName ? "My account" : "Sign in"}
          </Link>
        </div>
      </nav>
    </header>
  );
}
