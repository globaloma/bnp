import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderDiscountType } from "@/types/db";

export function computeOrderTotals({
  unitPrice,
  quantity,
  vatRate,
  discountType,
  discountValue,
  deliveryFee = 0,
}: {
  unitPrice: number;
  quantity: number;
  vatRate: number;
  discountType?: OrderDiscountType | null;
  discountValue?: number;
  deliveryFee?: number;
}): { subtotal: number; discountAmount: number; vatAmount: number; deliveryFee: number; total: number } {
  const subtotal = unitPrice * quantity;

  let discountAmount = 0;
  if (discountType === "fixed") {
    discountAmount = Math.min(discountValue ?? 0, subtotal);
  } else if (discountType === "percentage") {
    discountAmount = subtotal * (Math.min(discountValue ?? 0, 100) / 100);
  }

  const discounted = subtotal - discountAmount;
  const vatAmount = discounted * (vatRate / 100);
  const total = discounted + vatAmount + deliveryFee;

  return { subtotal, discountAmount, vatAmount, deliveryFee, total };
}

/**
 * Totals for an order with several products, where the discount and the
 * delivery fee are entered once for the whole order. Each product is still
 * stored as its own order row, so this splits them across the lines:
 * a percentage applies to every line as-is, a fixed amount is shared out in
 * proportion to each line's subtotal, and delivery sits on the first line.
 */
export function computeMultiLineTotals({
  lines,
  discountType,
  discountValue = 0,
  deliveryFee = 0,
}: {
  lines: { unitPrice: number; quantity: number; vatRate: number }[];
  discountType?: OrderDiscountType | null;
  discountValue?: number;
  deliveryFee?: number;
}) {
  const orderSubtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const fixedTotal = discountType === "fixed" ? Math.min(discountValue, orderSubtotal) : 0;

  let fixedAllocated = 0;
  const perLine = lines.map((l, i) => {
    const lineSubtotal = l.unitPrice * l.quantity;
    let lineDiscountValue = discountValue;
    if (discountType === "fixed") {
      const isLast = i === lines.length - 1;
      lineDiscountValue = isLast
        ? round2(fixedTotal - fixedAllocated)
        : orderSubtotal > 0
          ? round2((fixedTotal * lineSubtotal) / orderSubtotal)
          : 0;
      fixedAllocated += lineDiscountValue;
    }
    const totals = computeOrderTotals({
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      vatRate: l.vatRate,
      discountType,
      discountValue: discountType ? lineDiscountValue : 0,
      deliveryFee: i === 0 ? deliveryFee : 0,
    });
    return { ...totals, discountValue: discountType ? lineDiscountValue : 0 };
  });

  const sum = (key: "subtotal" | "discountAmount" | "vatAmount" | "deliveryFee" | "total") =>
    perLine.reduce((acc, l) => acc + l[key], 0);

  return {
    perLine,
    subtotal: sum("subtotal"),
    discountAmount: sum("discountAmount"),
    vatAmount: sum("vatAmount"),
    deliveryFee: sum("deliveryFee"),
    total: sum("total"),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
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
