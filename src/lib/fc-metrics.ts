import { LOW_STOCK_THRESHOLD } from "@/types/db";
import type { ProductWithMerchant } from "@/lib/data/fulfillment-center";

export {
  ordersToday,
  revenueInFlight,
  deliveredToday,
  pendingReview,
} from "@/lib/dashboard-metrics";

export function lowStockMerchants(
  products: ProductWithMerchant[],
): { partner_id: string; merchant_name: string; count: number }[] {
  const byMerchant = new Map<string, { merchant_name: string; count: number }>();
  for (const p of products) {
    if (p.stock > LOW_STOCK_THRESHOLD) continue;
    const entry = byMerchant.get(p.partner_id) ?? {
      merchant_name: p.merchant_name,
      count: 0,
    };
    entry.count += 1;
    byMerchant.set(p.partner_id, entry);
  }
  return Array.from(byMerchant, ([partner_id, v]) => ({ partner_id, ...v }));
}
