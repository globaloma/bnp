import { daysSince, isToday } from "@/lib/format";
import {
  LOW_STOCK_THRESHOLD,
  STALE_DAYS_THRESHOLD,
  type Order,
  type Partner,
  type Product,
} from "@/types/db";

const IN_FLIGHT_STATUSES = ["Packaging", "Shipping"] as const;
const NEEDS_REVIEW_STATUSES = ["Returned", "Damaged"] as const;

export function ordersToday<T extends Pick<Order, "placed_at">>(orders: T[]): T[] {
  return orders.filter((o) => isToday(o.placed_at));
}

export function revenueInFlight<T extends Pick<Order, "status" | "total">>(
  orders: T[],
): number {
  return orders
    .filter((o) => (IN_FLIGHT_STATUSES as readonly string[]).includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);
}

export function deliveredToday<T extends Pick<Order, "status" | "updated_at">>(
  orders: T[],
): T[] {
  return orders.filter((o) => o.status === "Delivered" && isToday(o.updated_at));
}

export function pendingReview<T extends Pick<Order, "status">>(orders: T[]): T[] {
  return orders.filter((o) => (NEEDS_REVIEW_STATUSES as readonly string[]).includes(o.status));
}

type StockShape = Pick<Product, "id" | "stock" | "last_moved_at">;

export function lowStockProducts<T extends StockShape>(products: T[]): T[] {
  return products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);
}

export function staleProducts<T extends StockShape>(products: T[]): T[] {
  return products.filter((p) => daysSince(p.last_moved_at) > STALE_DAYS_THRESHOLD);
}

export function walletAvailable(partner: Partner): number {
  return partner.wallet_balance - partner.wallet_buffer;
}

export function isFulfillmentRestricted(partner: Partner): boolean {
  return walletAvailable(partner) <= 0;
}

export function isWalletLow(partner: Partner): boolean {
  return walletAvailable(partner) < 10000;
}

export function alertCount<T extends StockShape>(
  products: T[],
  partner: Partner,
): number {
  const uniqueFlagged = new Set([
    ...lowStockProducts(products).map((p) => p.id),
    ...staleProducts(products).map((p) => p.id),
  ]);
  return uniqueFlagged.size + (isWalletLow(partner) ? 1 : 0);
}
