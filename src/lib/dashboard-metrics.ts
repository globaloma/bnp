import { daysSince, isToday } from "@/lib/format";
import { OPEN_STATUSES } from "@/lib/order-status";
import { isLowStock } from "@/lib/low-stock";
import {
  STALE_DAYS_THRESHOLD,
  type Order,
  type Partner,
  type Product,
} from "@/types/db";

const IN_FLIGHT_STATUSES = OPEN_STATUSES;
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

type StockShape = Pick<Product, "id" | "stock" | "last_moved_at"> & { low_stock_threshold?: number | null };

export function lowStockProducts<T extends StockShape>(products: T[]): T[] {
  return products.filter((p) => isLowStock(p));
}

export function staleProducts<T extends StockShape>(products: T[]): T[] {
  return products.filter((p) => daysSince(p.last_moved_at) > STALE_DAYS_THRESHOLD);
}

export function walletAvailable(partner: Partner): number {
  return partner.wallet_balance - partner.wallet_buffer;
}

/**
 * New orders are blocked when a Standard invoice is overdue (billing_locked,
 * migration 0028) or when an Enterprise wallet wasn't funded above the
 * minimum at month end (wallet_locked, migration 0032).
 */
export function isFulfillmentRestricted(partner: Partner): boolean {
  return partner.billing_locked || (partner.plan_type === "enterprise" && partner.wallet_locked);
}

/** Why new orders are blocked, in the merchant's words, or null. */
export function restrictionMessage(partner: Partner): string | null {
  if (partner.billing_locked) {
    return "Your account is paused because an invoice is overdue. Pay it on the Billing page to create new orders.";
  }
  if (partner.plan_type === "enterprise" && partner.wallet_locked) {
    return "New orders are on hold because your wallet wasn't funded above your agreed minimum at month end. Top up your wallet to create orders again.";
  }
  return null;
}

/** Enterprise only: the wallet is close to, or at, the agreed minimum. */
export function isWalletLow(partner: Partner): boolean {
  return partner.plan_type === "enterprise" && partner.wallet_alert !== "ok";
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
