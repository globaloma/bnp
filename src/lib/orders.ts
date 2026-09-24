import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderDiscountType } from "@/types/db";

export function computeOrderTotals({
  unitPrice,
  quantity,
  vatRate,
  discountType,
  discountValue,
}: {
  unitPrice: number;
  quantity: number;
  vatRate: number;
  discountType?: OrderDiscountType | null;
  discountValue?: number;
}): { subtotal: number; discountAmount: number; vatAmount: number; total: number } {
  const subtotal = unitPrice * quantity;

  let discountAmount = 0;
  if (discountType === "fixed") {
    discountAmount = Math.min(discountValue ?? 0, subtotal);
  } else if (discountType === "percentage") {
    discountAmount = subtotal * (Math.min(discountValue ?? 0, 100) / 100);
  }

  const discounted = subtotal - discountAmount;
  const vatAmount = discounted * (vatRate / 100);
  const total = discounted + vatAmount;

  return { subtotal, discountAmount, vatAmount, total };
}

export function groupOrdersByRef(orders: Order[]): Map<string, Order[]> {
  const groups = new Map<string, Order[]>();
  for (const order of orders) {
    const existing = groups.get(order.order_ref);
    if (existing) {
      existing.push(order);
    } else {
      groups.set(order.order_ref, [order]);
    }
  }
  return groups;
}

export async function generateOrderRef(
  supabase: SupabaseClient,
  partnerId: string,
): Promise<string> {
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);

  return `ORD-${String((count ?? 0) + 41).padStart(4, "0")}`;
}
