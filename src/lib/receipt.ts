import { naira, formatDate } from "@/lib/format";
import type { Order } from "@/types/db";

export function normalizeNigerianPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  if (digits.startsWith("234")) return digits;
  return digits;
}

export function buildReceiptText(orderRef: string, lines: Order[]): string {
  const first = lines[0];
  const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const discount = lines.reduce((sum, l) => sum + l.discount_amount, 0);
  const vat = lines.reduce((sum, l) => sum + l.vat_amount, 0);
  const total = lines.reduce((sum, l) => sum + l.total, 0);

  const itemLines = lines
    .map((l) => `- ${l.product_name} x${l.quantity}: ${naira(l.total)}`)
    .join("\n");

  const parts = [
    `Receipt for order ${orderRef}`,
    `Date: ${formatDate(first.placed_at)}`,
    `Customer: ${first.customer_name}`,
    "",
    itemLines,
    "",
    `Subtotal: ${naira(subtotal)}`,
  ];
  if (discount > 0) parts.push(`Discount: -${naira(discount)}`);
  if (vat > 0) parts.push(`VAT: ${naira(vat)}`);
  parts.push(`Total: ${naira(total)}`);

  return parts.join("\n");
}
