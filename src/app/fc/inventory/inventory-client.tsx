"use client";

import { useMemo, useState } from "react";
import { Boxes, Printer, Search } from "lucide-react";
import { LOCATIONS, LOW_STOCK_THRESHOLD, type WarehouseLocation } from "@/types/db";
import { formatDate, naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/variants";
import { Button } from "@/components/ui/button";
import { EmptyState, StatCard } from "@/components/dashboard/ui";
import { PrintLabelsDialog, type PrintableLabel } from "@/components/dashboard/print-labels-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductWithMerchant } from "@/lib/data/fulfillment-center";

type StockFilter = "All" | "In stock" | "Low stock" | "Out of stock";

function stockBucket(stock: number): Exclude<StockFilter, "All"> {
  if (stock === 0) return "Out of stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "Low stock";
  return "In stock";
}

// SKUs get a barcode once they have a SKU code; until then there's nothing
// to print.
function skuLabel(p: ProductWithMerchant): PrintableLabel | null {
  if (!p.barcode) return null;
  return {
    barcode: p.barcode,
    heading: displayName(p),
    details: [p.merchant_name],
    onHand: p.on_hand,
  };
}

export function FcInventoryClient({ products }: { products: ProductWithMerchant[] }) {
  const [stockFilter, setStockFilter] = useState<StockFilter>("All");
  const [locFilter, setLocFilter] = useState<"All locations" | WarehouseLocation>(
    "All locations",
  );
  const [query, setQuery] = useState("");

  const totalStock = products.reduce((sum, p) => sum + p.on_hand, 0);
  const lowCount = products.filter((p) => stockBucket(p.stock) === "Low stock").length;
  const outCount = products.filter((p) => stockBucket(p.stock) === "Out of stock").length;
  const inCount = products.length - lowCount - outCount;

  const counts: Record<StockFilter, number> = {
    All: products.length,
    "In stock": inCount,
    "Low stock": lowCount,
    "Out of stock": outCount,
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesStock = stockFilter === "All" || stockBucket(p.stock) === stockFilter;
      const matchesLoc = locFilter === "All locations" || p.location === locFilter;
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.merchant_name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.variant ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.retail_barcode ?? "").includes(q);
      return matchesStock && matchesLoc && matchesQuery;
    });
  }, [products, stockFilter, locFilter, query]);
  const printable = visible.flatMap((p) => skuLabel(p) ?? []);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
        <StatCard label="Total stock" value={totalStock} sub="Across FCs and stores" accent="teal" />
        <StatCard
          label="Low stock SKUs"
          value={lowCount}
          sub="At or below their alert threshold"
          accent="gold"
        />
        <StatCard
          label="Out of stock SKUs"
          value={outCount}
          sub="Products with zero units available"
          accent="destructive"
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["All", "In stock", "Low stock", "Out of stock"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStockFilter(s)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                stockFilter === s
                  ? "border-navy bg-navy text-white"
                  : "border-stone bg-card text-graphite hover:border-teal/40",
              )}
            >
              {s} {counts[s]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {printable.length > 0 ? (
            <PrintLabelsDialog
              title={`Print labels for ${printable.length} SKU${printable.length === 1 ? "" : "s"}`}
              labels={printable}
              fileName="sku-labels.pdf"
              trigger={<Button variant="outline" size="sm" />}
            >
              <Printer />
              Print labels
            </PrintLabelsDialog>
          ) : null}
          <select
            value={locFilter}
            onChange={(e) =>
              setLocFilter(e.target.value as "All locations" | WarehouseLocation)
            }
            className="h-9 rounded-md border border-stone bg-card px-2.5 text-xs font-medium text-graphite"
          >
            {(["All locations", ...LOCATIONS] as const).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mist" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="h-9 w-48 rounded-md border border-stone bg-card pl-8 pr-2.5 text-xs text-navy outline-none focus-visible:border-teal"
            />
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-8" />}
          title="No products match"
          body="Try a different filter or search term."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">On-hand</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead>Restocked</TableHead>
                <TableHead>
                  <span className="sr-only">Label</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => {
                const bucket = stockBucket(p.stock);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-semibold text-navy">
                        {p.name}
                        {p.variant ? (
                          <span className="font-normal text-graphite"> · {p.variant}</span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-mist">
                        {p.sku || "No SKU"} · {p.location}
                      </div>
                      {p.barcode ? (
                        <div className="font-mono text-[10px] text-mist">{p.barcode}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>{p.merchant_name}</TableCell>
                    <TableCell>{naira(p.sale_price)}</TableCell>
                    <TableCell className="text-right">
                      {p.on_hand}
                      {p.staged > 0 ? (
                        <div className="text-[10px] font-semibold text-gold-300">+{p.staged} to put away</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{p.allocated}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "font-semibold",
                          bucket === "Out of stock"
                            ? "text-destructive"
                            : bucket === "Low stock"
                              ? "text-gold"
                              : "text-navy",
                        )}
                      >
                        {p.stock}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(p.last_moved_at)}</TableCell>
                    <TableCell>
                      <SkuLabelButton product={p} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SkuLabelButton({ product }: { product: ProductWithMerchant }) {
  const label = skuLabel(product);
  if (!label) {
    return <span className="text-[11px] text-mist">Needs a SKU</span>;
  }
  return (
    <PrintLabelsDialog
      title={`Print labels for ${label.heading}`}
      labels={[label]}
      fileName={`label-${label.barcode}.pdf`}
      trigger={
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap text-teal-700 hover:underline"
        />
      }
    >
      <Printer className="size-3" />
      Label
    </PrintLabelsDialog>
  );
}
