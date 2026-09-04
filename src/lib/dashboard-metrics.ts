import { daysSince } from "@/lib/format";
import {
  LOW_STOCK_THRESHOLD,
  STALE_DAYS_THRESHOLD,
  type Partner,
  type Product,
} from "@/types/db";

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
