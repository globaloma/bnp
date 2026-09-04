"use client";

import { Download } from "lucide-react";
import type { Order, Product, WalletTransaction } from "@/types/db";
import { Button } from "@/components/ui/button";

function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
  return lines
    .map((line) =>
      line
        .map((cell) => {
          const s = String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

function download(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({
  products,
  orders,
  walletTransactions,
}: {
  products: Product[];
  orders: Order[];
  walletTransactions: WalletTransaction[];
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      <Button
        variant="secondary"
        onClick={() =>
          download(
            toCsv(
              products.map((p) => ({
                SKU: p.sku ?? "",
                Name: p.name,
                Location: p.location,
                Stock: p.stock,
                CostPrice: p.cost_price,
                SalePrice: p.sale_price,
                VAT: p.vat,
                LastMoved: p.last_moved_at,
              })),
            ),
            "bnp_inventory.csv",
          )
        }
        disabled={products.length === 0}
      >
        <Download className="size-4" />
        Inventory CSV
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          download(
            toCsv(
              orders.map((o) => ({
                OrderID: o.order_ref,
                Customer: o.customer_name,
                Item: o.product_name,
                Qty: o.quantity,
                Total: o.total,
                Location: o.location,
                Status: o.status,
                Date: o.placed_at,
              })),
            ),
            "bnp_orders.csv",
          )
        }
        disabled={orders.length === 0}
      >
        <Download className="size-4" />
        Orders CSV
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          download(
            toCsv(
              walletTransactions.map((t) => ({
                Date: t.created_at,
                Type: t.type,
                Amount: t.amount,
                Note: t.note ?? "",
              })),
            ),
            "bnp_wallet_history.csv",
          )
        }
        disabled={walletTransactions.length === 0}
      >
        <Download className="size-4" />
        Wallet history CSV
      </Button>
    </div>
  );
}
