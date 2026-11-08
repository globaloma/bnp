"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import {
  Plus,
  Boxes,
  Eye,
  EyeOff,
  Pencil,
  Printer,
  Upload,
  Download,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Tag,
  PackagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { LOCATIONS, type Product, type WarehouseLocation } from "@/types/db";
import { daysSince, naira } from "@/lib/format";
import { onPromo, unitPrice } from "@/lib/product-price";
import { STALE_DAYS_THRESHOLD, LOW_STOCK_THRESHOLD } from "@/types/db";
import { isLowStock } from "@/lib/low-stock";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, StatCard } from "@/components/dashboard/ui";
import { PrintLabelsDialog } from "@/components/dashboard/print-labels-dialog";
import { displayName } from "@/lib/variants";
import { ImageUploadField } from "@/components/dashboard/image-upload";
import {
  addProduct,
  editProduct,
  importProducts,
  toggleProductPublished,
  setProductsPublished,
  deleteProducts,
  updateProductsPricing,
  restockProducts,
  type ProductCsvRow,
} from "./actions";
import type { ActionResult } from "@/lib/schemas/product";

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

type StockFilter = "All" | "In stock" | "Low stock" | "Out of stock";

function stockBucket(p: Pick<Product, "stock" | "low_stock_threshold">): Exclude<StockFilter, "All"> {
  if (p.stock <= 0) return "Out of stock";
  if (isLowStock(p)) return "Low stock";
  return "In stock";
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

type SortKey = "name" | "location" | "price" | "stock" | "published";
type SortState = { key: SortKey; dir: "asc" | "desc" };

function SortHeader({
  label,
  col,
  sort,
  onSort,
}: {
  label: string;
  col: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th className="px-3 py-2.5 font-semibold">
      <button
        type="button"
        onClick={() => onSort(col)}
        className="inline-flex items-center gap-1 transition-colors hover:text-navy"
      >
        {label}
        {active ? (
          sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

export function InventoryClient({
  products,
  merchantName,
}: {
  products: Product[];
  merchantName: string;
}) {
  const [locFilter, setLocFilter] = useState<"All" | WarehouseLocation>("All");
  const [stockFilter, setStockFilter] = useState<StockFilter>("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const totalStock = products.reduce((sum, p) => sum + p.on_hand, 0);
  const lowCount = products.filter((p) => stockBucket(p) === "Low stock").length;
  const outCount = products.filter((p) => stockBucket(p) === "Out of stock").length;
  const inCount = products.length - lowCount - outCount;
  const stockCounts: Record<StockFilter, number> = {
    All: products.length,
    "In stock": inCount,
    "Low stock": lowCount,
    "Out of stock": outCount,
  };

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (locFilter === "All" || p.location === locFilter) &&
          (stockFilter === "All" || stockBucket(p) === stockFilter) &&
          (needle === "" ||
            p.name.toLowerCase().includes(needle) ||
            (p.sku ?? "").toLowerCase().includes(needle) ||
            (p.variant ?? "").toLowerCase().includes(needle)),
      ),
    [products, locFilter, stockFilter, needle],
  );

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const arr = [...visible];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "name":
          cmp = displayName(a).localeCompare(displayName(b));
          break;
        case "location":
          cmp = a.location.localeCompare(b.location);
          break;
        case "price":
          cmp = unitPrice(a) - unitPrice(b);
          break;
        case "stock":
          cmp = a.stock - b.stock;
          break;
        case "published":
          cmp = Number(a.published) - Number(b.published);
          break;
      }
      // Fall back to name so the order is stable when the key ties.
      if (cmp === 0) cmp = displayName(a).localeCompare(displayName(b));
      return cmp * dir;
    });
    return arr;
  }, [visible, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  // When the filtered set changes, go back to the first page and drop any
  // selection so a bulk action never touches rows that are now hidden. This is
  // React's "adjust state during render" pattern — no effect, no extra paint.
  const filterKey = `${locFilter}|${stockFilter}|${needle}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
    setSelected(new Set());
  }

  // Reordering or changing the page size keeps the same items, so only the
  // page resets here — the selection is left intact.
  const viewKey = `${sort.key}|${sort.dir}|${pageSize}`;
  const [prevViewKey, setPrevViewKey] = useState(viewKey);
  if (viewKey !== prevViewKey) {
    setPrevViewKey(viewKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageIds = pageItems.map((p) => p.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const selectedItems = useMemo(
    () => visible.filter((p) => selected.has(p.id)),
    [visible, selected],
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
        <StatCard label="Total stock" value={totalStock} sub="Across all your warehouses" accent="teal" />
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

      <div className="mb-3 flex flex-wrap gap-2">
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
            {s} {stockCounts[s]}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["All", ...LOCATIONS] as const).map((loc) => (
            <button
              key={loc}
              onClick={() => setLocFilter(loc)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                locFilter === loc
                  ? "border-gold bg-gold text-navy"
                  : "border-stone bg-card text-graphite hover:border-teal/40",
              )}
            >
              {loc}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger render={<Button size="lg" variant="outline" />}>
              <Upload className="size-4" />
              Import CSV
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import products from CSV</DialogTitle>
              </DialogHeader>
              <ImportCsvForm onDone={() => setImportOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="lg" />}>
              <Plus className="size-4" />
              Add product
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add product to inventory</DialogTitle>
              </DialogHeader>
              <ProductForm onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or SKU"
            className={cn(fieldClass, "pl-9")}
          />
        </div>
        <span className="ml-auto text-xs text-mist">
          {visible.length} product{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {selectedItems.length > 0 ? (
        <BulkBar
          items={selectedItems}
          total={visible.length}
          merchantName={merchantName}
          onSelectAll={() => setSelected(new Set(sorted.map((p) => p.id)))}
          onClear={() => setSelected(new Set())}
        />
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-8" />}
          title={needle || locFilter !== "All" || stockFilter !== "All" ? "No matching products" : "No products yet"}
          body={
            needle || locFilter !== "All" || stockFilter !== "All"
              ? "Try clearing the search or filters."
              : "Add your first product to start tracking stock and creating orders against it."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-stone bg-card">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone bg-stone/40 text-left text-[11px] uppercase tracking-[0.06em] text-graphite">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={togglePage}
                      aria-label="Select all on this page"
                      className="size-4 accent-navy"
                    />
                  </th>
                  <SortHeader label="Product" col="name" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Location" col="location" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Price" col="price" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Stock" col="stock" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Storefront" col="published" sort={sort} onSort={toggleSort} />
                  <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <ProductRow
                    key={item.id}
                    item={item}
                    merchantName={merchantName}
                    selected={selected.has(item.id)}
                    onToggle={() => toggleOne(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-graphite">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 rounded-md border border-stone bg-white px-2 text-xs text-navy outline-none focus-visible:border-teal"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-xs text-mist">
                Showing {(safePage - 1) * pageSize + 1}&ndash;{Math.min(safePage * pageSize, visible.length)} of {visible.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="text-xs font-semibold text-graphite">
                Page {safePage} of {pageCount}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const actionBtnClass = "rounded-md p-1.5 text-graphite transition-colors hover:bg-stone hover:text-navy";

function ProductRow({
  item,
  merchantName,
  selected,
  onToggle,
}: {
  item: Product;
  merchantName: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const isLow = isLowStock(item);
  const isStale = daysSince(item.last_moved_at) > STALE_DAYS_THRESHOLD;
  const [published, setPublished] = useState(item.published);
  const [editOpen, setEditOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleTogglePublished() {
    const next = !published;
    startTransition(async () => {
      const result = await toggleProductPublished(item.id, next);
      if (result.ok) {
        setPublished(next);
        toast.success(next ? "Visible on your storefront" : "Hidden from your storefront");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <tr className={cn("border-b border-stone/70 align-middle last:border-0", selected && "bg-navy/5")}>
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${item.name}`}
          className="size-4 accent-navy"
        />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-stone">
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt={item.name} className="size-full object-cover" />
            ) : (
              <Boxes className="size-4 text-mist" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-navy">
              {item.name}
              {item.variant ? <span className="font-normal text-graphite"> · {item.variant}</span> : null}
            </div>
            <div className="truncate text-[11px] text-mist">{item.sku || "No SKU"}</div>
            {item.staged > 0 ? (
              <div className="text-[10px] font-semibold text-gold-300">{item.staged} being shelved</div>
            ) : null}
            {item.quarantined > 0 ? (
              <div className="text-[10px] font-semibold text-destructive">{item.quarantined} in quarantine</div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-graphite">{item.location}</td>
      <td className="px-3 py-2.5">
        <div className="font-semibold text-success">
          {onPromo(item) ? (
            <>
              {naira(unitPrice(item))}{" "}
              <span className="font-normal text-mist line-through">{naira(item.sale_price)}</span>
            </>
          ) : (
            naira(item.sale_price)
          )}
        </div>
        <div className="text-[11px] text-mist">VAT {item.vat}%</div>
      </td>
      <td className="px-3 py-2.5">
        <div className={cn("font-semibold", isLow ? "text-destructive" : "text-navy")}>
          {item.stock}
          {isLow ? " !" : ""}
        </div>
        <div className="text-[11px] text-mist">
          {item.on_hand} on-hand · {item.allocated} reserved
        </div>
        {isStale ? <div className="text-[10px] font-semibold text-gold">Stale 30+ days</div> : null}
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={handleTogglePublished}
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60",
            published
              ? "border-success/40 bg-success/10 text-success"
              : "border-gold/50 bg-gold/10 text-gold-300",
          )}
        >
          {published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {published ? "Visible" : "Hidden"}
        </button>
        {item.pickup_enabled ? (
          <div className="mt-0.5 text-[10px] font-semibold text-success">Pickup</div>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger render={<button type="button" title="Edit" className={actionBtnClass} />}>
              <Pencil className="size-4" />
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit product</DialogTitle>
              </DialogHeader>
              <ProductForm product={item} onDone={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={variantOpen} onOpenChange={setVariantOpen}>
            <DialogTrigger render={<button type="button" title="Add variant" className={actionBtnClass} />}>
              <Plus className="size-4" />
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New variant of {item.name}</DialogTitle>
              </DialogHeader>
              <p className="-mt-1 text-xs text-graphite">
                Each colour or size is its own SKU with its own stock and barcode.
              </p>
              <ProductForm variantOf={item} onDone={() => setVariantOpen(false)} />
            </DialogContent>
          </Dialog>

          {item.barcode ? (
            <PrintLabelsDialog
              title={`Print labels for ${displayName(item)}`}
              labels={[
                {
                  barcode: item.barcode,
                  heading: displayName(item),
                  details: [merchantName],
                  onHand: item.on_hand,
                },
              ]}
              fileName={`label-${item.barcode}.pdf`}
              trigger={<button type="button" title="Print barcode labels" className={actionBtnClass} />}
            >
              <Printer className="size-4" />
            </PrintLabelsDialog>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

const EXPORT_HEADER =
  "sku,name,variant,category,cost_price,sale_price,promo_price,vat,stock,location,shipping_fee,pickup_enabled,image_url,description";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportProductsCsv(items: Product[]) {
  const lines = items.map((p) =>
    [
      p.sku ?? "",
      p.name,
      p.variant ?? "",
      p.category ?? "",
      p.cost_price,
      p.sale_price,
      p.promo_price ?? "",
      p.vat,
      p.stock,
      p.location,
      p.shipping_fee ?? "",
      p.pickup_enabled ? "true" : "false",
      p.image_url ?? "",
      p.description ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob([`${EXPORT_HEADER}\n${lines.join("\n")}\n`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function BulkBar({
  items,
  total,
  merchantName,
  onSelectAll,
  onClear,
}: {
  items: Product[];
  total: number;
  merchantName: string;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [priceMode, setPriceMode] = useState<"sale" | "discount" | "clear">("sale");
  const [saleVal, setSaleVal] = useState("");
  const [pctVal, setPctVal] = useState("");
  const [qtyVal, setQtyVal] = useState("");
  const ids = items.map((p) => p.id);
  const labelItems = items.filter((p) => p.barcode);

  function applyPricing() {
    const op =
      priceMode === "sale"
        ? { type: "sale" as const, salePrice: Number(saleVal) }
        : priceMode === "discount"
          ? { type: "discount" as const, percent: Number(pctVal) }
          : { type: "clearPromo" as const };
    startTransition(async () => {
      const result = await updateProductsPricing(ids, op);
      if (result.ok) {
        toast.success(`Pricing updated for ${ids.length} product${ids.length === 1 ? "" : "s"}`);
        setPriceOpen(false);
        setSaleVal("");
        setPctVal("");
        onClear();
      } else {
        toast.error(result.error);
      }
    });
  }

  function applyRestock() {
    startTransition(async () => {
      const result = await restockProducts(ids, Number(qtyVal));
      if (result.ok) {
        toast.success(
          result.announced ? `Restock announced to the warehouse (${result.announced})` : "Restock announced",
        );
        setRestockOpen(false);
        setQtyVal("");
        onClear();
      } else {
        toast.error(result.error);
      }
    });
  }

  function setPublished(published: boolean) {
    startTransition(async () => {
      const result = await setProductsPublished(ids, published);
      if (result.ok) {
        toast.success(
          published ? `${ids.length} shown on storefront` : `${ids.length} hidden from storefront`,
        );
        onClear();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProducts(ids);
      if (result.ok) {
        toast.success(`${ids.length} product${ids.length === 1 ? "" : "s"} deleted`);
        setConfirmOpen(false);
        onClear();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-navy/20 bg-navy/5 px-3 py-2">
      <span className="text-sm font-semibold text-navy">{items.length} selected</span>
      {items.length < total ? (
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs font-semibold text-teal-700 hover:underline"
        >
          Select all {total}
        </button>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setPublished(true)}>
          <Eye className="size-4" />
          Show
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setPublished(false)}>
          <EyeOff className="size-4" />
          Hide
        </Button>
        {labelItems.length > 0 ? (
          <PrintLabelsDialog
            title={`Print labels for ${labelItems.length} product${labelItems.length === 1 ? "" : "s"}`}
            labels={labelItems.map((p) => ({
              barcode: p.barcode!,
              heading: displayName(p),
              details: [merchantName],
              onHand: p.on_hand,
            }))}
            fileName={`labels-${labelItems.length}.pdf`}
            trigger={<Button size="sm" variant="outline" />}
          >
            <Printer className="size-4" />
            Print labels
          </PrintLabelsDialog>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => exportProductsCsv(items)}>
          <Download className="size-4" />
          Export
        </Button>

        <Button size="sm" variant="outline" disabled={pending} onClick={() => setPriceOpen(true)}>
          <Tag className="size-4" />
          Price
        </Button>
        <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                Update price for {items.length} product{items.length === 1 ? "" : "s"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                {(["sale", "discount", "clear"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm text-navy">
                    <input
                      type="radio"
                      name="priceMode"
                      checked={priceMode === m}
                      onChange={() => setPriceMode(m)}
                      className="accent-navy"
                    />
                    {m === "sale" ? "Set sale price" : m === "discount" ? "Apply a discount" : "Clear promo price"}
                  </label>
                ))}
              </div>
              {priceMode === "sale" ? (
                <div>
                  <label className={labelClass}>New sale price (₦)</label>
                  <input
                    type="number"
                    min="0"
                    value={saleVal}
                    onChange={(e) => setSaleVal(e.target.value)}
                    placeholder="e.g. 7500"
                    className={fieldClass}
                  />
                  <p className="mt-1 text-[11px] text-mist">Applies to every selected product and clears any existing promo.</p>
                </div>
              ) : priceMode === "discount" ? (
                <div>
                  <label className={labelClass}>Discount (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={pctVal}
                    onChange={(e) => setPctVal(e.target.value)}
                    placeholder="e.g. 10"
                    className={fieldClass}
                  />
                  <p className="mt-1 text-[11px] text-mist">Sets each product&apos;s promo price to that much off its own sale price.</p>
                </div>
              ) : (
                <p className="text-sm text-graphite">
                  Removes the promo price from the selected products, so they go back to full sale price.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPriceOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  onClick={applyPricing}
                  disabled={pending || (priceMode === "sale" && !saleVal) || (priceMode === "discount" && !pctVal)}
                >
                  {pending ? "Saving" : "Apply"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button size="sm" variant="outline" disabled={pending} onClick={() => setRestockOpen(true)}>
          <PackagePlus className="size-4" />
          Restock
        </Button>
        <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                Restock {items.length} product{items.length === 1 ? "" : "s"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelClass}>Units to add to each</label>
                <input
                  type="number"
                  min="1"
                  value={qtyVal}
                  onChange={(e) => setQtyVal(e.target.value)}
                  placeholder="e.g. 50"
                  className={fieldClass}
                />
              </div>
              <p className="text-[11px] text-mist">
                Announces an inbound delivery for the selected products (one per warehouse). The warehouse is
                emailed to receive it; stock becomes available once it&apos;s received and put away.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRestockOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button onClick={applyRestock} disabled={pending || !qtyVal}>
                  {pending ? "Announcing" : "Announce delivery"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger
            render={
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/5"
              />
            }
          >
            <Trash2 className="size-4" />
            Delete
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                Delete {items.length} product{items.length === 1 ? "" : "s"}?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-graphite">
              This permanently removes {items.length === 1 ? "this product" : "these products"} from your
              inventory. A product still tied to an order can&apos;t be deleted.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={handleDelete}
                disabled={pending}
              >
                {pending ? "Deleting" : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <button type="button" onClick={onClear} className="ml-1 text-xs font-semibold text-graphite hover:underline">
          Clear
        </button>
      </div>
    </div>
  );
}

function ProductForm({
  product,
  variantOf,
  onDone,
}: {
  product?: Product;
  /** Prefills from this product and saves the new SKU as its variant. */
  variantOf?: Product;
  onDone: () => void;
}) {
  const isEdit = Boolean(product);
  // Shared details come from the product being edited, or the one this is
  // a new variant of. SKU, variant and stock are always per SKU.
  const base = product ?? variantOf;
  const boundAction = isEdit ? editProduct.bind(null, product!.id) : addProduct;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await boundAction(prev, formData);
      if (result.ok) {
        toast.success(isEdit ? "Product updated" : "Product added");
        onDone();
      }
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <ImageUploadField
        bucket="product-images"
        name="imageUrl"
        initialUrl={base?.image_url ?? undefined}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Product name *</label>
          <input
            name="name"
            required
            defaultValue={base?.name}
            className={fieldClass}
            placeholder="e.g. Ankara Tote"
          />
          {errors?.name ? <p className="mt-1 text-xs text-destructive">{errors.name[0]}</p> : null}
        </div>
        <div>
          <label className={labelClass}>SKU</label>
          <input
            name="sku"
            defaultValue={product?.sku ?? ""}
            className={fieldClass}
            placeholder="Blank = make one"
          />
          {errors?.sku ? <p className="mt-1 text-xs text-destructive">{errors.sku[0]}</p> : null}
        </div>
      </div>

      {variantOf ? <input type="hidden" name="variantOf" value={variantOf.id} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Variant (colour / size)</label>
          <input
            name="variant"
            defaultValue={product?.variant ?? ""}
            required={Boolean(variantOf)}
            className={fieldClass}
            placeholder="e.g. Red, Large"
          />
        </div>
        <div>
          <label className={labelClass}>Retail barcode (EAN/UPC)</label>
          <input
            name="retailBarcode"
            inputMode="numeric"
            defaultValue={product?.retail_barcode ?? ""}
            className={fieldClass}
            placeholder="Optional"
          />
          {errors?.retailBarcode ? (
            <p className="mt-1 text-xs text-destructive">{errors.retailBarcode[0]}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label className={labelClass}>Category</label>
        <input
          name="category"
          defaultValue={base?.category ?? ""}
          className={fieldClass}
          placeholder="e.g. Bags"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Cost price (₦)</label>
          <input
            name="costPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={base?.cost_price}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Sale price (₦) *</label>
          <input
            name="salePrice"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={base?.sale_price}
            className={fieldClass}
          />
          {errors?.salePrice ? (
            <p className="mt-1 text-xs text-destructive">{errors.salePrice[0]}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label className={labelClass}>Promo price (₦)</label>
        <input
          name="promoPrice"
          type="number"
          min="0"
          step="0.01"
          defaultValue={base?.promo_price ?? ""}
          className={fieldClass}
          placeholder="Leave blank for no promo"
        />
        {errors?.promoPrice ? (
          <p className="mt-1 text-xs text-destructive">{errors.promoPrice[0]}</p>
        ) : (
          <p className="mt-1 text-[11px] text-mist">
            Customers pay this instead of the sale price until you clear it. Your store shows both.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>VAT (%)</label>
          <input
            name="vat"
            type="number"
            min="0"
            step="0.1"
            defaultValue={base?.vat ?? 7.5}
            className={fieldClass}
          />
        </div>
        {product ? (
          <div>
            <span className={labelClass}>In the warehouse</span>
            <div className="flex h-10 items-center rounded-md border border-stone bg-stone/40 px-3 text-sm font-semibold text-navy">
              {product.on_hand} on hand
            </div>
            <p className="mt-1 text-[11px] text-mist">
              {product.allocated > 0 ? `${product.allocated} reserved, ${product.stock} available. ` : ""}
              To add stock,{" "}
              <a href="/dashboard/deliveries" className="font-semibold text-teal-700 hover:underline">
                announce a delivery
              </a>
              .
            </p>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Units you&apos;re sending us</label>
            <input
              name="incoming"
              type="number"
              min="0"
              defaultValue={0}
              className={fieldClass}
            />
            {errors?.incoming ? (
              <p className="mt-1 text-xs text-destructive">{errors.incoming[0]}</p>
            ) : (
              <p className="mt-1 text-[11px] text-mist">
                We announce the delivery to the warehouse. Stock appears once it&apos;s scanned in.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Warehouse location</label>
          <select
            name="location"
            defaultValue={base?.location ?? "Abuja"}
            className={cn(fieldClass, "appearance-none")}
          >
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Shipping fee (₦)</label>
          <input
            name="shippingFee"
            type="number"
            min="0"
            step="0.01"
            defaultValue={base?.shipping_fee ?? 1200}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Weight per unit (kg)</label>
        <input
          name="weightKg"
          type="number"
          min="0"
          step="0.001"
          defaultValue={base?.weight_kg ?? ""}
          placeholder="e.g. 0.5"
          className={fieldClass}
        />
        {errors?.weightKg ? (
          <p className="mt-1 text-xs text-destructive">{errors.weightKg[0]}</p>
        ) : (
          <p className="mt-1 text-[11px] text-mist">Used to price GIG and UPS deliveries.</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Declared value per unit (₦)</label>
        {product?.declared_value !== null && product?.declared_value !== undefined ? (
          <>
            <input type="hidden" name="declaredValueLocked" value="1" />
            <div className="flex h-10 items-center rounded-md border border-stone bg-stone/40 px-3 text-sm font-semibold text-navy">
              {naira(product.declared_value)} per unit, locked
            </div>
            <p className="mt-1 text-[11px] text-mist">
              To change it,{" "}
              <a href="/dashboard/billing" className="font-semibold text-teal-700 hover:underline">
                request a change
              </a>{" "}
              on the Billing page.
            </p>
          </>
        ) : (
          <>
            <input
              name="declaredValue"
              type="number"
              min="0"
              step="0.01"
              defaultValue=""
              placeholder="What one unit is worth"
              className={fieldClass}
            />
            {errors?.declaredValue ? (
              <p className="mt-1 text-xs text-destructive">{errors.declaredValue[0]}</p>
            ) : (
              <p className="mt-1 text-[11px] text-mist">
                Used to insure your stock. It locks once saved; later changes need our approval.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <label className={labelClass}>Low-stock alert</label>
        <div className="flex items-center gap-2 text-sm text-graphite">
          <span>Email me when available stock falls to</span>
          <input
            name="lowStockThreshold"
            type="number"
            min="0"
            defaultValue={product?.low_stock_threshold ?? ""}
            placeholder={String(LOW_STOCK_THRESHOLD)}
            className={cn(fieldClass, "w-20")}
          />
        </div>
        {errors?.lowStockThreshold ? (
          <p className="mt-1 text-xs text-destructive">{errors.lowStockThreshold[0]}</p>
        ) : (
          <p className="mt-1 text-[11px] text-mist">
            Leave blank for the default of {LOW_STOCK_THRESHOLD}. You get one email each time it drops.
          </p>
        )}
      </div>

      <div>
        <label className={labelClass}>Description (shown on your store)</label>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={base?.description ?? ""}
          placeholder="What it is, size or weight, what it's made of, how to use it..."
          className={cn(fieldClass, "h-auto py-2")}
        />
        {errors?.description ? (
          <p className="mt-1 text-xs text-destructive">{errors.description[0]}</p>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-xs font-medium text-graphite">
        <input
          type="checkbox"
          name="pickupEnabled"
          defaultChecked={base?.pickup_enabled ?? false}
          className="size-4 rounded border-stone"
        />
        Enable customer pickup option
      </label>

      {!isEdit ? (
        <label className="flex items-center gap-2 text-xs font-medium text-graphite">
          <input
            type="checkbox"
            name="published"
            defaultChecked
            className="size-4 rounded border-stone"
          />
          Show on your public storefront
        </label>
      ) : null}

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? "Saving" : isEdit ? "Save changes" : "Save product"}
      </Button>
    </form>
  );
}

// The template keeps only the columns most merchants need: sku, name and
// sale_price are required, the rest are handy. The importer still accepts the
// advanced columns (cost_price, vat, location, shipping_fee, pickup_enabled,
// image_url, description, declared_value, weight_kg, promo_price) when a file
// has them, so Shopify-style exports and re-imports keep working — they're just
// not in the starter template. Photos are added per product in the app, not here.
const CSV_TEMPLATE_HEADER = "sku,name,variant,category,sale_price,stock";
const CSV_TEMPLATE_EXAMPLE = "ATB-RED,Ankara Tote Bag,Red,Bags,7500,25";

function downloadCsvTemplate() {
  const blob = new Blob([`${CSV_TEMPLATE_HEADER}\n${CSV_TEMPLATE_EXAMPLE}\n`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "product-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvRows(rows: Record<string, string>[]): {
  valid: ProductCsvRow[];
  errors: string[];
} {
  const valid: ProductCsvRow[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const line = i + 2; // +1 for header row, +1 for 1-indexing
    const sku = row.sku?.trim();
    const name = row.name?.trim();
    const salePrice = Number(row.sale_price);

    if (!sku) {
      errors.push(`Row ${line}: missing sku`);
      return;
    }
    if (!name) {
      errors.push(`Row ${line}: missing name`);
      return;
    }
    if (!row.sale_price || Number.isNaN(salePrice)) {
      errors.push(`Row ${line}: missing or invalid sale_price`);
      return;
    }

    const location = row.location?.trim() as WarehouseLocation | undefined;
    if (location && !(LOCATIONS as string[]).includes(location)) {
      errors.push(`Row ${line}: unknown location "${row.location}", defaulted to Abuja`);
    }

    let promo: number | null | undefined;
    if (row.promo_price !== undefined) {
      const promoText = row.promo_price.trim();
      promo = promoText ? Number(promoText) : null;
      if (promo !== null && (!Number.isFinite(promo) || promo < 0 || promo >= salePrice)) {
        errors.push(`Row ${line}: promo_price "${row.promo_price}" has to be lower than sale_price, left unchanged`);
        promo = undefined;
      }
    }

    const weightText = row.weight_kg?.trim();
    const weight = weightText ? Number(weightText) : undefined;
    if (weight !== undefined && (!Number.isFinite(weight) || weight < 0 || weight > 10000)) {
      errors.push(`Row ${line}: weight_kg "${row.weight_kg}" isn't a weight in kg, left unchanged`);
    }

    valid.push({
      sku,
      name,
      category: row.category?.trim() || undefined,
      cost_price: row.cost_price ? Number(row.cost_price) : undefined,
      sale_price: salePrice,
      promo_price: promo,
      vat: row.vat ? Number(row.vat) : undefined,
      stock: row.stock ? Number(row.stock) : undefined,
      location: location && (LOCATIONS as string[]).includes(location) ? location : undefined,
      shipping_fee: row.shipping_fee ? Number(row.shipping_fee) : undefined,
      pickup_enabled: ["true", "1", "yes"].includes(row.pickup_enabled?.trim().toLowerCase() ?? ""),
      image_url: row.image_url?.trim() || undefined,
      variant: row.variant?.trim() || undefined,
      // Kept as "" (not undefined) when the column exists but is blank, so the
      // import knows the file has a description column.
      description: row.description !== undefined ? row.description.trim() : undefined,
      declared_value: row.declared_value ? Number(row.declared_value) : undefined,
      weight_kg: weight !== undefined && Number.isFinite(weight) && weight >= 0 && weight <= 10000 ? weight : undefined,
    });
  });

  return { valid, errors };
}

function ImportCsvForm({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<ProductCsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    setFileName(file.name);
    file.text().then((text) => {
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        // Tolerate files exported from Excel / Google Sheets: strip a UTF-8 BOM
        // off the first header, and normalise case and stray spaces so "SKU",
        // " sku" and "Sku" all match the column names we expect.
        transformHeader: (h) => h.replace(/^﻿/, "").trim().toLowerCase(),
      });

      // If a required column is missing from the header row entirely, say so
      // once — instead of repeating "missing sku" on every single row.
      const headers = parsed.meta.fields ?? [];
      const missingCols = ["sku", "name", "sale_price"].filter((c) => !headers.includes(c));
      if (missingCols.length > 0) {
        setRows([]);
        setErrors([
          `This file is missing the ${missingCols.join(", ")} column${missingCols.length > 1 ? "s" : ""}. ` +
            `Download the CSV template above and keep its header row unchanged.`,
        ]);
        return;
      }
      if (parsed.data.length === 0) {
        setRows([]);
        setErrors(["No product rows found below the header. Add at least one product and try again."]);
        return;
      }

      const { valid, errors: rowErrors } = parseCsvRows(parsed.data);
      setRows(valid);
      setErrors(rowErrors);
    });
  }

  function handleImport() {
    startTransition(async () => {
      const result = await importProducts(rows);
      if (result.ok) {
        toast.success(
          result.announced
            ? `${result.imported ?? rows.length} products imported. Delivery ${result.announced} announced to the warehouse.`
            : `${result.imported ?? rows.length} products imported`,
        );
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <button
        type="button"
        onClick={downloadCsvTemplate}
        className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline"
      >
        <Download className="size-3.5" />
        Download CSV template
      </button>
      <p className="text-xs leading-relaxed text-graphite">
        Only <span className="font-mono">sku</span>, <span className="font-mono">name</span> and{" "}
        <span className="font-mono">sale_price</span> are required. Add product photos after importing, from each
        product&apos;s page.
      </p>
      <p className="text-xs leading-relaxed text-graphite">
        The <span className="font-mono">stock</span> column is how many units you&apos;re sending us. We announce
        them to the warehouse as a delivery, and they show as on hand once they&apos;re scanned in.
      </p>

      <div>
        <label className={labelClass}>CSV file</label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className={cn(fieldClass, "h-auto py-2")}
        />
        {fileName ? <p className="mt-1 text-xs text-mist">{fileName}</p> : null}
      </div>

      {errors.length > 0 ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <p className="text-xs text-graphite">{rows.length} product(s) ready to import.</p>
      ) : null}

      <Button
        type="button"
        size="lg"
        disabled={pending || rows.length === 0}
        onClick={handleImport}
        className="mt-1 w-full"
      >
        {pending ? "Importing" : `Import ${rows.length || ""} products`}
      </Button>
    </div>
  );
}
