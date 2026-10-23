"use server";

import { unitPrice } from "@/lib/product-price";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeMultiLineTotals, computeOrderTotals, generateOrderRef } from "@/lib/orders";
import { orderSchema, orderEditSchema, type ActionResult } from "@/lib/schemas/order";
import type { OrderStatus } from "@/types/db";
import { ORDER_STATUSES } from "@/types/db";
import { MERCHANT_EDITABLE, merchantCanEdit, merchantStatusOptions } from "@/lib/order-status";
import { initializeTransaction } from "@/lib/paystack";
import { after } from "next/server";
import { requestDeliveryConfirmation } from "@/lib/delivery-feedback";
import { alertFulfillmentCenters } from "@/lib/notifications";
import { sendQueuedLowStockAlerts } from "@/lib/low-stock-email";
import { priceDelivery } from "@/lib/delivery-pricing";
import type { DeliveryProgress } from "@/lib/delivery-progress";
import type { DeliveryMethod } from "@/lib/delivery-methods";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export async function getOrderPaymentLink(
  orderRef: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { data: rows } = await supabase
    .from("orders")
    .select("total, customer_email, payment_status, channel")
    .eq("partner_id", user.id)
    .eq("order_ref", orderRef);

  if (!rows || rows.length === 0) {
    return { ok: false, error: "Order not found." };
  }

  const first = rows[0];
  if (first.channel !== "storefront" || first.payment_status !== "pending") {
    return { ok: false, error: "This order isn't awaiting online payment." };
  }

  const { data: partner } = await supabase
    .from("partners")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  if (!partner) return { ok: false, error: "Could not find your store." };

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const reference = `${user.id.slice(0, 8)}-${orderRef}-R${Date.now()}`;
  const email = first.customer_email || `guest+${orderRef.toLowerCase()}@bnpfulfillment.com`;

  let authorizationUrl: string;
  try {
    const result = await initializeTransaction({
      email,
      amountKobo: Math.round(grandTotal * 100),
      reference,
      callbackUrl: `${SITE_URL}/store/${partner.slug}/confirm`,
      metadata: { partnerId: user.id, orderRef },
    });
    authorizationUrl = result.authorizationUrl;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start payment. Please try again.",
    };
  }

  // Reusing the old payment_ref would collide with Paystack's duplicate-
  // reference check on an abandoned first attempt, so retries get a fresh
  // one and the order rows are repointed at it.
  await supabase
    .from("orders")
    .update({ payment_ref: reference })
    .eq("partner_id", user.id)
    .eq("order_ref", orderRef);

  return { ok: true, url: authorizationUrl };
}

export async function createOrder(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  let itemsInput: unknown;
  try {
    itemsInput = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "The product list could not be read. Please try again." };
  }

  const parsed = orderSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone") || undefined,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
    notes: formData.get("notes") || undefined,
    items: itemsInput,
    deliveryMethod: formData.get("deliveryMethod") || undefined,
    deliveryZone: formData.get("deliveryZone") || undefined,
    weightKg: formData.get("weightKg") || 0,
    pickupAt: formData.get("pickupAt") || undefined,
    discountType: formData.get("discountType") || undefined,
    discountValue: formData.get("discountValue") || 0,
    deliveryFee: formData.get("deliveryFee") || 0,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d = parsed.data;

  // The same product picked twice becomes one line with the combined quantity.
  const quantities = new Map<string, number>();
  for (const item of d.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const { data: partner } = await supabase
    .from("partners")
    .select("charges_vat, business_name")
    .eq("id", user.id)
    .single();

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, sale_price, promo_price, vat, stock, location, weight_kg")
    .in("id", [...quantities.keys()]);

  if (productError || !products || products.length !== quantities.size) {
    return { ok: false, error: "One of those products could not be found." };
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [...quantities].map(([productId, quantity]) => ({
    product: byId.get(productId)!,
    quantity,
  }));

  for (const { product, quantity } of lines) {
    if (product.stock < quantity) {
      return {
        ok: false,
        error: `Only ${product.stock} units of ${product.name} are available.`,
      };
    }
  }

  // BNP delivery is priced from our rates and billed to the merchant; their
  // own rider costs BNP nothing and the fee is what they charge the customer.
  const method = d.deliveryMethod as DeliveryMethod;
  const priced = await priceDelivery(supabase, {
    method,
    hub: lines[0].product.location,
    zone: d.deliveryZone,
    weightKg: d.weightKg,
    partnerId: user.id,
    ownFee: d.deliveryFee,
    mode: "merchant",
  });
  if (!priced.ok) {
    return { ok: false, error: priced.error, fieldErrors: { deliveryZone: [priced.error] } };
  }
  const delivery = priced.delivery;
  let pickupAt: string | null = null;
  if (method === "walk_in") {
    const when = d.pickupAt ? new Date(`${d.pickupAt}:00+01:00`) : null;
    if (!when || Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      return { ok: false, error: "Choose when the customer will collect.", fieldErrors: { pickupAt: ["Choose a time"] } };
    }
    pickupAt = when.toISOString();
  }
  const deliveryFee = delivery.fee;
  const vatRates = lines.map(({ product }) => (partner?.charges_vat ? product.vat : 0));
  let orderRef: string;
  try {
    orderRef = await generateOrderRef(supabase, user.id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create the order." };
  }
  const totals = computeMultiLineTotals({
    lines: lines.map(({ product, quantity }, i) => ({
      unitPrice: unitPrice(product),
      quantity,
      vatRate: vatRates[i],
    })),
    discountType: d.discountType,
    discountValue: d.discountValue,
    deliveryFee,
  });

  const { error: insertError } = await supabase.from("orders").insert(
    lines.map(({ product, quantity }, i) => {
      const t = totals.perLine[i];
      return {
        partner_id: user.id,
        order_ref: orderRef,
        customer_name: d.customerName,
        customer_phone: d.customerPhone || null,
        delivery_address: d.deliveryAddress || null,
        notes: d.notes || null,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice(product),
        subtotal: t.subtotal,
        discount_type: d.discountType ?? null,
        discount_value: t.discountValue,
        discount_amount: t.discountAmount,
        vat_rate: vatRates[i],
        vat_amount: t.vatAmount,
        delivery_fee: t.deliveryFee,
        total: t.total,
        location: product.location,
        rider: delivery.rider,
        delivery_method: method,
        delivery_zone: delivery.zone,
        delivery_weight_kg: d.weightKg || null,
        delivery_billed_to: method === "own_rider" || deliveryFee === 0 ? ("none" as const) : ("merchant" as const),
        pickup_at: pickupAt,
        status: "Reserved" as const,
        channel: "dashboard" as const,
        payment_status: "paid" as const,
      };
    }),
  );

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  // No stock edit here: inserting Reserved lines makes the database allocate
  // the stock (orders_apply_stock, migration 0022). On-hand only drops when
  // the warehouse dispatches the order.

  // Fulfillment centers hear about dashboard orders too, not just storefront
  // sales, so they can start packing. Sent after the response.
  after(() => sendQueuedLowStockAlerts());
  after(() =>
    alertFulfillmentCenters({
      merchantName: partner?.business_name ?? "A merchant",
      orderRef,
      customerName: d.customerName,
      lines: lines.map(({ product, quantity }, i) => ({
        product_name: product.name,
        quantity,
        total: totals.perLine[i].total,
      })),
      source: "dashboard",
      delivery: pickupAt
        ? `Walk-in collection, ${new Date(pickupAt).toLocaleString("en-NG", {
            timeZone: "Africa/Lagos",
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}`
        : delivery.label,
    }),
  );

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult> {
  if (!ORDER_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (!current) return { ok: false, error: "That order could not be found." };
  if (!merchantStatusOptions(current.status as OrderStatus).includes(status)) {
    return { ok: false, error: `An order that is ${current.status} can't be changed to ${status}.` };
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select("partner_id, order_ref")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  if (status === "Delivered" && updated) {
    after(() => requestDeliveryConfirmation(updated.partner_id, updated.order_ref));
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function editOrder(
  orderId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, order_ref, product_id, quantity, unit_price, vat_rate, status, rider, delivery_fee, delivery_method")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    return { ok: false, error: "That order could not be found." };
  }
  const currentStatus = order.status as OrderStatus;

  const parsed = orderEditSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone") || undefined,
    customerEmail: formData.get("customerEmail") || undefined,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
    notes: formData.get("notes") || undefined,
    quantity: formData.get("quantity"),
    rider: formData.get("rider"),
    status: formData.get("status"),
    discountType: formData.get("discountType") || undefined,
    discountValue: formData.get("discountValue") || 0,
    deliveryFee: formData.get("deliveryFee") || 0,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d = parsed.data;

  if (!merchantStatusOptions(currentStatus).includes(d.status)) {
    return {
      ok: false,
      error: `An order that is ${currentStatus} can't be changed to ${d.status}.`,
    };
  }

  // Once the warehouse starts picking, only the status can change (e.g. to
  // Delivered after dispatch). Everything else is handled by the BNP team.
  if (!merchantCanEdit(currentStatus)) {
    const { error: statusError } = await supabase
      .from("orders")
      .update({ status: d.status })
      .eq("id", orderId);
    if (statusError) return { ok: false, error: statusError.message };
    if (d.status === "Delivered") {
      after(() => requestDeliveryConfirmation(user.id, order.order_ref));
    }
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard");
    return { ok: true };
  }

  const { data: partner } = await supabase
    .from("partners")
    .select("charges_vat")
    .eq("id", user.id)
    .single();

  // The product's own VAT rate is looked up fresh here (not the order's
  // frozen vat_rate), so edits always reflect the merchant's current
  // charges_vat setting rather than whatever was true at creation time.
  // The synthetic "Shipping" row has no product_id, so it just keeps
  // whatever rate was already on the order (never VAT-bearing in practice).
  let productVatRate = order.vat_rate;
  if (order.product_id) {
    const { data: product } = await supabase
      .from("products")
      .select("id, stock, vat")
      .eq("id", order.product_id)
      .single();

    if (product) {
      productVatRate = product.vat;

      // The database moves the reservation when the quantity changes; this
      // only stops it going past what's available (`stock` is available).
      const extra = d.quantity - order.quantity;
      if (d.status === "Reserved" && extra > product.stock) {
        return {
          ok: false,
          error: `Only ${product.stock} more available, so the quantity can go up to ${order.quantity + product.stock}.`,
        };
      }
    }
  }

  // BNP delivery (dispatch, GIG, UPS, walk-in) is priced when the order is
  // created and billed to the merchant, so it can't be changed here.
  const bnpDelivery = order.delivery_method !== null && order.delivery_method !== "own_rider";
  const rider = bnpDelivery ? order.rider : d.rider;
  const deliveryFee = bnpDelivery ? Number(order.delivery_fee) : d.rider === "Own Rider" ? d.deliveryFee : 0;
  const vatRate = partner?.charges_vat ? productVatRate : 0;
  const totals = computeOrderTotals({
    unitPrice: order.unit_price,
    quantity: d.quantity,
    vatRate,
    discountType: d.discountType,
    discountValue: d.discountValue,
    deliveryFee,
  });

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      customer_name: d.customerName,
      customer_phone: d.customerPhone || null,
      customer_email: d.customerEmail || null,
      delivery_address: d.deliveryAddress || null,
      notes: d.notes || null,
      quantity: d.quantity,
      rider,
      ...(bnpDelivery ? {} : { delivery_method: d.rider === "Own Rider" ? ("own_rider" as const) : null }),
      status: d.status,
      subtotal: totals.subtotal,
      discount_type: d.discountType ?? null,
      discount_value: d.discountValue,
      discount_amount: totals.discountAmount,
      vat_rate: vatRate,
      vat_amount: totals.vatAmount,
      delivery_fee: deliveryFee,
      total: totals.total,
    })
    .eq("id", orderId);

  if (updateError) return { ok: false, error: updateError.message };

  if (d.status === "Delivered") {
    after(() => requestDeliveryConfirmation(user.id, order.order_ref));
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

const LOCKED_MESSAGE =
  "The warehouse has started on this order, so it can't be changed here. Contact the BNP team.";

// Orders can only be deleted before picking starts, or once cancelled. The
// database releases any reserved stock as the lines go.
const DELETABLE: OrderStatus[] = [...MERCHANT_EDITABLE, "Cancelled"];

export async function deleteOrderLine(orderId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    return { ok: false, error: "That order could not be found." };
  }
  if (!DELETABLE.includes(order.status as OrderStatus)) return { ok: false, error: LOCKED_MESSAGE };

  const { error: deleteError } = await supabase.from("orders").delete().eq("id", orderId);
  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteOrderGroups(orderRefs: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  if (orderRefs.length === 0) return { ok: false, error: "No orders selected." };

  const { data: lines, error: fetchError } = await supabase
    .from("orders")
    .select("id, status")
    .in("order_ref", orderRefs)
    .eq("partner_id", user.id);

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!lines || lines.length === 0) {
    return { ok: false, error: "Those orders could not be found." };
  }
  if (lines.some((l) => !DELETABLE.includes(l.status as OrderStatus))) {
    return {
      ok: false,
      error:
        "Some of these orders are already with the warehouse, so they can't be deleted. Contact the BNP team.",
    };
  }

  const { error: deleteError } = await supabase
    .from("orders")
    .delete()
    .in("order_ref", orderRefs)
    .eq("partner_id", user.id);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteOrderGroup(orderRef: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { data: lines, error: fetchError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("order_ref", orderRef)
    .eq("partner_id", user.id);

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!lines || lines.length === 0) {
    return { ok: false, error: "That order could not be found." };
  }
  if (lines.some((l) => !DELETABLE.includes(l.status as OrderStatus))) {
    return { ok: false, error: LOCKED_MESSAGE };
  }

  const { error: deleteError } = await supabase
    .from("orders")
    .delete()
    .eq("order_ref", orderRef)
    .eq("partner_id", user.id);

  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** For the merchant's own dispatched orders: on the way, or a failed attempt. */
export async function setDeliveryProgress(
  orderRef: string,
  progress: DeliveryProgress,
  note?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };
  const { error } = await supabase.rpc("set_delivery_progress", {
    p_partner: user.id,
    p_order_ref: orderRef,
    p_progress: progress,
    p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/orders");
  return { ok: true };
}
