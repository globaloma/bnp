import { LOW_STOCK_THRESHOLD, type Product } from "@/types/db";

// Low stock: each product can set its own alert level; without one, the
// platform default applies. Matches default_low_stock_threshold() in
// migration 0026, which queues the alert emails.

type Thresholded = Pick<Product, "stock"> & { low_stock_threshold?: number | null };

export function lowStockLevel(p: Pick<Thresholded, "low_stock_threshold">): number {
  return p.low_stock_threshold ?? LOW_STOCK_THRESHOLD;
}

export function isLowStock(p: Thresholded): boolean {
  return p.stock <= lowStockLevel(p);
}
