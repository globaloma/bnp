import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderPaymentStatus, OrderRider, OrderStatus } from "@/types/db";

// Public order lookup for /store/[slug]/track. Customers have no account,
// and order refs are sequential per merchant (ORD-0041, ORD-0042...), so a
// ref alone would let anyone read anyone's order. The lookup needs the ref
// AND the phone number given at checkout, and both kinds of miss return the
// same "not found" so the page can't be used to confirm which refs exist.

export type TrackedOrder = {
  orderRef: string;
  placedAt: string;
  stage: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  rider: OrderRider | null;
  location: string | null;
  deliveryAddress: string | null;
  items: { name: string; quantity: number; status: OrderStatus }[];
  total: number;
};

type Row = {
  order_ref: string;
  placed_at: string;
  status: OrderStatus;
  payment_status: OrderPaymentStatus;
  payment_ref: string | null;
  rider: OrderRider | null;
  location: string | null;
  delivery_address: string | null;
  customer_phone: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  total: number;
};

/** Last 10 digits, so 0801 234 5678, +234 801 234 5678 and 2348012345678 match. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

const PROGRESS: OrderStatus[] = ["Packaged", "Shipped", "Delivered"];

/** The order is only as far along as its least-advanced item. */
function overallStage(statuses: OrderStatus[]): OrderStatus {
  const problem = statuses.find((s) => s === "Damaged" || s === "Returned");
  if (problem) return problem;
  const lowest = Math.min(...statuses.map((s) => PROGRESS.indexOf(s)));
  return PROGRESS[Math.max(0, lowest)];
}

export async function findTrackedOrder(
  slug: string,
  orderRef: string,
  phone: string,
): Promise<TrackedOrder | null> {
  const ref = orderRef.trim().toUpperCase();
  const key = phoneKey(phone);
  if (!ref || key.length < 7) return null;

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!partner) return null;

  const { data } = await admin
    .from("orders")
    .select(
      "order_ref, placed_at, status, payment_status, payment_ref, rider, location, delivery_address, customer_phone, product_id, product_name, quantity, total",
    )
    .eq("partner_id", partner.id)
    .eq("order_ref", ref)
    .order("placed_at", { ascending: false })
    .returns<Row[]>();

  const rows = (data ?? []).filter(
    (r) => r.customer_phone && phoneKey(r.customer_phone) === key,
  );
  if (rows.length === 0) return null;

  // Keep only the most recent order with this ref, in case a ref was ever
  // reused after an older order was deleted.
  const latest = rows[0];
  const group = rows.filter((r) =>
    latest.payment_ref ? r.payment_ref === latest.payment_ref : r.placed_at === latest.placed_at,
  );

  const items = group.filter((r) => r.product_id);
  const itemRows = items.length > 0 ? items : group;

  return {
    orderRef: latest.order_ref,
    placedAt: latest.placed_at,
    stage: overallStage(itemRows.map((r) => r.status)),
    paymentStatus: latest.payment_status,
    rider: latest.rider,
    location: latest.location,
    deliveryAddress: latest.delivery_address,
    items: itemRows.map((r) => ({
      name: r.product_name,
      quantity: r.quantity,
      status: r.status,
    })),
    total: group.reduce((sum, r) => sum + Number(r.total), 0),
  };
}
