"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useShopHref } from "./shop-base";

const OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const href = useShopHref();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-xs text-graphite">
      Sort by
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("sort", e.target.value);
          next.delete("page");
          router.push(href(`/search?${next.toString()}`));
        }}
        className="h-9 rounded-md border border-stone bg-white px-2 text-sm text-navy"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
