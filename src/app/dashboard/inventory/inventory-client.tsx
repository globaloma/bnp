"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { Plus, Boxes, Eye, EyeOff, Pencil, Printer, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { LOCATIONS, type Product, type WarehouseLocation } from "@/types/db";
import { daysSince, naira } from "@/lib/format";
import { STALE_DAYS_THRESHOLD, LOW_STOCK_THRESHOLD } from "@/types/db";
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
  type ProductCsvRow,
} from "./actions";
import type { ActionResult } from "@/lib/schemas/product";

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

type StockFilter = "All" | "In stock" | "Low stock" | "Out of stock";

function stockBucket(stock: number): Exclude<StockFilter, "All"> {
  if (stock === 0) return "Out of stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "Low stock";
  return "In stock";
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
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const totalStock = products.reduce((sum, p) => sum + p.on_hand, 0);
  const lowCount = products.filter((p) => stockBucket(p.stock) === "Low stock").length;
  const outCount = products.filter((p) => stockBucket(p.stock) === "Out of stock").length;
  const inCount = products.length - lowCount - outCount;
  const stockCounts: Record<StockFilter, number> = {
    All: products.length,
    "In stock": inCount,
    "Low stock": lowCount,
    "Out of stock": outCount,
  };

  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (locFilter === "All" || p.location === locFilter) &&
          (stockFilter === "All" || stockBucket(p.stock) === stockFilter),
      ),
    [products, locFilter, stockFilter],
  );

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

      {visible.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-8" />}
          title="No products yet"
          body="Add your first product to start tracking stock and creating orders against it."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <ProductCard key={item.id} item={item} merchantName={merchantName} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ item, merchantName }: { item: Product; merchantName: string }) {
  const isLow = item.stock <= LOW_STOCK_THRESHOLD;
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
    <div
      className={cn(
        "overflow-hidden rounded-lg border-t-[3px] border-stone bg-card shadow-sm",
        isLow ? "border-t-destructive" : isStale ? "border-t-gold" : "border-t-teal",
      )}
    >
      <div className="flex h-24 items-center justify-center bg-stone">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.name}
            className="size-full object-cover"
          />
        ) : (
          <Boxes className="size-8 text-mist" />
        )}
      </div>
      <div className="p-3.5">
        <div className="text-sm font-semibold text-navy">
          {item.name}
          {item.variant ? <span className="font-normal text-graphite"> · {item.variant}</span> : null}
        </div>
        <div className="mb-1.5 text-[11px] text-mist">
          {item.sku || "No SKU"} · {item.location}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-success">
            {naira(item.sale_price)}
          </span>
          <span className="text-mist">Cost {naira(item.cost_price)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-graphite">VAT {item.vat}%</span>
          <span className={cn(isLow && "font-bold text-destructive")}>
            {item.stock} available{isLow ? " !" : ""}
          </span>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-1 rounded-md bg-stone/60 px-2 py-1 text-center text-[10px] text-graphite">
          <span>
            <span className="block font-semibold text-navy">{item.on_hand}</span>On-hand
          </span>
          <span>
            <span className="block font-semibold text-navy">{item.allocated}</span>Reserved
          </span>
          <span>
            <span className="block font-semibold text-navy">{item.stock}</span>Available
          </span>
        </div>
        {item.staged > 0 ? (
          <div className="mt-1 text-[10px] font-semibold text-gold-300">
            {item.staged} arrived, being shelved. Sellable once put away.
          </div>
        ) : null}
        {item.quarantined > 0 ? (
          <div className="mt-1 text-[10px] font-semibold text-destructive">
            {item.quarantined} returned damaged, held in quarantine.
          </div>
        ) : null}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger
            render={
              <button
                type="button"
                className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
              />
            }
          >
            <Pencil className="size-3" />
            Edit
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit product</DialogTitle>
            </DialogHeader>
            <ProductForm product={item} onDone={() => setEditOpen(false)} />
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
            trigger={
              <button
                type="button"
                className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
              />
            }
          >
            <Printer className="size-3" />
            Print barcode labels
          </PrintLabelsDialog>
        ) : null}
        <Dialog open={variantOpen} onOpenChange={setVariantOpen}>
          <DialogTrigger
            render={
              <button
                type="button"
                className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
              />
            }
          >
            <Plus className="size-3" />
            Add variant
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
        {item.pickup_enabled ? (
          <div className="mt-1.5 text-[10px] font-semibold text-success">
            Pickup enabled
          </div>
        ) : null}
        {isStale ? (
          <div className="mt-1 text-[10px] font-semibold text-gold">
            Stale, 30+ days
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleTogglePublished}
          disabled={pending}
          className={cn(
            "mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60",
            published
              ? "border-stone text-graphite hover:border-teal/40"
              : "border-gold/50 bg-gold/10 text-gold-300",
          )}
        >
          {published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {published ? "Visible on storefront" : "Hidden from storefront"}
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

const CSV_TEMPLATE_HEADER =
  "sku,name,variant,category,cost_price,sale_price,vat,stock,location,shipping_fee,pickup_enabled,image_url,description";
const CSV_TEMPLATE_EXAMPLE =
  "ATB-RED,Ankara Tote,Red,Bags,4000,7500,7.5,20,Abuja,1200,false,,Hand-sewn Ankara print tote with inner pocket";

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

    valid.push({
      sku,
      name,
      category: row.category?.trim() || undefined,
      cost_price: row.cost_price ? Number(row.cost_price) : undefined,
      sale_price: salePrice,
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
      });
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
