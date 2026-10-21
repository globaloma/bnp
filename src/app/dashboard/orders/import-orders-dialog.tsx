"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { AlertCircle, CheckCircle2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/types/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importOrders, type ImportResult } from "./import-actions";
import type { ImportRow } from "@/lib/order-import";

const COLUMNS = [
  "order_group",
  "customer_name",
  "customer_phone",
  "customer_email",
  "delivery_address",
  "sku",
  "product",
  "available",
  "quantity",
  "delivery",
  "delivery_fee",
  "notes",
] as const;

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** One row per product, so merchants only add customers and quantities. */
function downloadTemplate(products: Product[]) {
  const rows = products
    .filter((p) => p.sku)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({
      order_group: "",
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      delivery_address: "",
      sku: p.sku,
      product: p.variant ? `${p.name} (${p.variant})` : p.name,
      available: p.stock,
      quantity: "",
      delivery: "BNP Fleet",
      delivery_fee: "",
      notes: "",
    }));
  download("bnp-order-upload.csv", Papa.unparse({ fields: [...COLUMNS], data: rows }));
}

export function ImportOrdersDialog({ products, disabled }: { products: Product[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [raw, setRaw] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFileName(null);
    setRows(null);
    setRaw([]);
    setResult(null);
    setDone(false);
  }

  function check(file: File) {
    reset();
    setFileName(file.name);
    file.text().then((text) => {
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      });
      // Line numbers as a spreadsheet shows them: the header is line 1.
      const list: ImportRow[] = parsed.data.map((r, i) => ({ ...r, line: i + 2 }));
      setRaw(parsed.data);
      setRows(list);
      startTransition(async () => {
        setResult(await importOrders(list, { create: false }));
      });
    });
  }

  function create() {
    if (!rows) return;
    startTransition(async () => {
      const r = await importOrders(rows, { create: true });
      setResult(r);
      setDone(true);
      if (r.ok && r.created.length > 0) {
        toast.success(`${r.created.length} order${r.created.length === 1 ? "" : "s"} created and sent to the warehouse.`);
      } else if (!r.ok) {
        toast.error(r.error);
      }
    });
  }

  function downloadProblems() {
    if (!result?.ok) return;
    const bad = new Map(result.rows.filter((r) => !r.ok).map((r) => [r.line, r.reason ?? ""]));
    const data = raw
      .map((r, i) => ({ row: r, line: i + 2 }))
      .filter(({ line }) => bad.has(line))
      .map(({ row, line }) => ({ ...row, problem: bad.get(line) }));
    download("orders-to-fix.csv", Papa.unparse(data));
  }

  const ok = result?.ok ? result : null;
  const problems = ok ? ok.rows.filter((r) => !r.ok) : [];
  const goodRows = ok ? ok.rows.filter((r) => r.ok) : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button size="lg" variant="outline" disabled={disabled} />}>
        <Upload className="size-4" />
        Upload orders
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload orders from a spreadsheet</DialogTitle>
        </DialogHeader>

        <ol className="list-decimal space-y-1 pl-5 text-sm text-graphite">
          <li>
            <button
              type="button"
              onClick={() => downloadTemplate(products)}
              className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
            >
              <Download className="size-3.5" />
              Download your template
            </button>{" "}
            . It lists every product you have, with its SKU.
          </li>
          <li>
            On each row you need, fill in the customer, phone, address and quantity. Leave the rest blank; empty rows
            are ignored.
          </li>
          <li>
            For an order with several products, give those rows the same <span className="font-mono">order_group</span>{" "}
            (for example A1). Delivery is BNP Fleet, Own Rider or Pickup.
          </li>
          <li>Upload it below. We check every row before anything is created.</li>
        </ol>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) check(file);
          }}
          className="h-auto w-full rounded-md border border-stone bg-white px-3 py-2 text-sm"
        />
        {fileName ? <p className="-mt-2 text-xs text-mist">{fileName}</p> : null}

        {pending && !result ? <p className="text-sm text-graphite">Checking your file…</p> : null}
        {result && !result.ok ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {result.error}
          </p>
        ) : null}

        {ok ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {done ? (
                <span className="flex items-center gap-1.5 font-semibold text-success">
                  <CheckCircle2 className="size-4" />
                  {ok.created.length} order{ok.created.length === 1 ? "" : "s"} created
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-semibold text-success">
                  <CheckCircle2 className="size-4" />
                  {ok.orders} order{ok.orders === 1 ? "" : "s"} ready ({goodRows.length} row
                  {goodRows.length === 1 ? "" : "s"})
                </span>
              )}
              {problems.length > 0 ? (
                <span className="flex items-center gap-1.5 font-semibold text-destructive">
                  <AlertCircle className="size-4" />
                  {problems.length} row{problems.length === 1 ? "" : "s"} with problems
                </span>
              ) : null}
              {problems.length > 0 ? (
                <button
                  type="button"
                  onClick={downloadProblems}
                  className="text-xs font-semibold text-teal-700 hover:underline"
                >
                  Download rows to fix
                </button>
              ) : null}
            </div>

            <div className="max-h-80 overflow-auto rounded-md border border-stone">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-cream">
                  <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-mist">
                    <th className="px-3 py-2 font-semibold">Line</th>
                    <th className="px-3 py-2 font-semibold">Customer</th>
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone">
                  {[...problems, ...goodRows].map((r) => (
                    <tr key={r.line} className={cn(!r.ok && "bg-destructive/5")}>
                      <td className="px-3 py-2 font-mono text-graphite">{r.line}</td>
                      <td className="px-3 py-2 text-navy">
                        {r.customer}
                        {r.group ? <span className="ml-1 text-mist">({r.group})</span> : null}
                      </td>
                      <td className="px-3 py-2 text-navy">{r.product}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.quantity ?? ""}</td>
                      <td className={cn("px-3 py-2", r.ok ? "text-success" : "text-destructive")}>
                        {r.ok ? (r.orderRef ? `Created ${r.orderRef}` : "Ready") : r.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!done ? (
              <Button size="lg" onClick={create} disabled={pending || ok.orders === 0}>
                {pending
                  ? "Creating"
                  : ok.orders === 0
                    ? "Nothing to create yet"
                    : `Create ${ok.orders} order${ok.orders === 1 ? "" : "s"}${problems.length ? ", skip the rest" : ""}`}
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={() => setOpen(false)}>
                Done
              </Button>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
