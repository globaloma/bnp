import { naira } from "@/lib/format";
import type { Order } from "@/types/db";

export function normalizeNigerianPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  if (digits.startsWith("234")) return digits;
  return digits;
}

/**
 * The short note that goes with a shared receipt. The receipt itself is the
 * PDF (attached on phones, linked on computers), so this only says what it
 * is and the total.
 */
export function buildReceiptShareMessage(
  orderRef: string,
  lines: Order[],
  link?: string,
): string {
  const first = lines[0];
  const total = lines.reduce((sum, l) => sum + l.total, 0);

  const parts = [
    `Hi ${first.customer_name}, here is your receipt for order ${orderRef} (total ${naira(total)}).`,
  ];
  if (link) parts.push("", `Download your receipt (PDF): ${link}`);
  parts.push("", "Thank you for your order.");

  return parts.join("\n");
}
