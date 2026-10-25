"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/public";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { computeOrderTotals, generateOrderRef } from "@/lib/orders";
import { initializeTransaction } from "@/lib/paystack";
import { withinRateLimit } from "@/lib/spam-guard";
import { displayName } from "@/lib/variants";
import { loadDeliveryOptions, priceDelivery } from "@/lib/delivery-pricing";
import { availableMethods, type DeliveryMethod } from "@/lib/delivery-methods";
import { getCustomer } from "@/lib/marketplace/customer";
import { getShopOrigin } from "@/lib/marketplace/shop";
import type { WarehouseLocation } from "@/types/db";

export type CheckoutResult = { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20)
  .regex(/^[0-9+()\s-]+$/, "Enter a valid phone number");

const schema = z.object({
  customerName: z.string().trim().min(2, "Enter your name").max(140),
  customerPhone: phone,
  customerEmail: z.string().trim().email("Enter a valid email address").max(200).optional().or(z.literal("")),
  deliveryAddress: z.string().trim().max(500).default(""),
  saveAddress: z.boolean().default(false),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(999) }))
    .min(1, "Your cart is empty")
    .max(100),
  // How each warehouse's parcels come to the customer.
  // Only the warehouses in this cart are present (partialRecord: a plain
  // record with enum keys requires every key in zod 4).
  delivery: z.partialRecord(
    z.enum(["Abuja", "Lagos"]),
    z.object({
      method: z.enum(["bnp_dispatch", "gig", "ups", "walk_in"]),
      zone: z.string().trim().max(120).default(""),
    }),
  ),
});

function checkoutCode() {
  // 10 unambiguous characters for the payment reference.
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  return [...randomBytes(10)].map((b) => alphabet[b % alphabet.length]).join("");
}

export async function startMarketplaceCheckout(_prev: CheckoutResult | null, formData: FormData): Promise<CheckoutResult> {
  if (!(await withinRateLimit("checkout"))) {
    return { ok: false, error: "Too many checkout attempts. Please wait a few minutes and try again." };
  }

  let parsedJson: { items: unknown; delivery: unknown };
  try {
    parsedJson = {
      items: JSON.parse(String(formData.get("items") ?? "[]")),
      delivery: JSON.parse(String(formData.get("delivery") ?? "{}")),
    };
  } catch {
    return { ok: false, error: "Your cart could not be read. Please refresh and try again." };
  }
  const parsed = schema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail") || undefined,
    deliveryAddress: formData.get("deliveryAddress") || "",
    saveAddress: formData.get("saveAddress") === "1",
    ...parsedJson,
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const visible = ["customerName", "customerPhone", "customerEmail", "deliveryAddress"];
    if (!Object.keys(fieldErrors).some((k) => visible.includes(k))) {
      console.error("[marketplace checkout] bad cart or delivery data", fieldErrors);
      return { ok: false, error: "Your cart or delivery choice couldn't be read. Refresh the page and try again." };
    }
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;
  const customer = await getCustomer();

  // Today's listing: price, stock, and whether it's still for sale at all.
  const quantities = new Map<string, number>();
  for (const i of d.items) quantities.set(i.productId, (quantities.get(i.productId) ?? 0) + i.quantity);
  const { data: listed } = await createClient()
    .from("marketplace_products")
    .select("id, partner_id, name, variant, price, vat, stock, location, weight_kg")
    .in("id", [...quantities.keys()]);
  const byId = new Map((listed ?? []).map((p) => [p.id as string, p]));

  type Line = { productId: string; partnerId: string; name: string; quantity: number; unitPrice: number; vatRate: number; subtotal: number; vatAmount: number; total: number; hub: WarehouseLocation; weightKg: number };
  const lines: Line[] = [];
  for (const [productId, quantity] of quantities) {
    const p = byId.get(productId);
    if (!p) return { ok: false, error: "One of the items in your cart is no longer for sale. Go back to your cart to update it." };
    if (p.stock < quantity) {
      return { ok: false, error: `Only ${p.stock} of ${displayName(p)} left. Update your cart and try again.` };
    }
    const unit = Number(p.price);
    const vatRate = Number(p.vat);
    const t = computeOrderTotals({ unitPrice: unit, quantity, vatRate });
    lines.push({
      productId,
      partnerId: p.partner_id,
      name: displayName(p),
      quantity,
      unitPrice: unit,
      vatRate,
      subtotal: t.subtotal,
      vatAmount: t.vatAmount,
      total: t.total,
      hub: p.location as WarehouseLocation,
      weightKg: Number(p.weight_kg) * quantity,
    });
  }

  // One parcel (and one order) per seller per warehouse.
  const shipments = new Map<string, Line[]>();
  for (const l of lines) shipments.set(`${l.partnerId}|${l.hub}`, [...(shipments.get(`${l.partnerId}|${l.hub}`) ?? []), l]);

  const admin = createAdminClient();
  const hubs = [...new Set(lines.map((l) => l.hub))];
  const offered = new Map<WarehouseLocation, DeliveryMethod[]>();
  for (const hub of hubs) {
    const options = await loadDeliveryOptions(admin, hub, lines.find((l) => l.hub === hub)!.partnerId);
    offered.set(hub, availableMethods(options, "store").filter((m) => m !== "own_rider"));
  }
  const allPickup = hubs.every((h) => d.delivery[h as "Abuja" | "Lagos"]?.method === "walk_in");
  if (!allPickup && d.deliveryAddress.length < 5) {
    return { ok: false, error: "Enter your delivery address.", fieldErrors: { deliveryAddress: ["Enter your delivery address"] } };
  }

  const checkoutRef = checkoutCode();
  const reference = `MKT-${checkoutRef}`;
  const rows: Record<string, unknown>[] = [];

  for (const [key, group] of shipments) {
    const [partnerId, hub] = key.split("|") as [string, WarehouseLocation];
    const choice = d.delivery[hub as "Abuja" | "Lagos"];
    if (!choice || !offered.get(hub)?.includes(choice.method)) {
      return { ok: false, error: `Choose how you want your items from ${hub} delivered.`, fieldErrors: { delivery: [hub] } };
    }
    const weightKg = Math.round(group.reduce((s, l) => s + l.weightKg, 0) * 100) / 100;
    let fee = 0;
    let label = "Pickup at the BNP hub";
    let zone: string | null = null;
    if (choice.method !== "walk_in") {
      const priced = await priceDelivery(admin, { method: choice.method, hub, zone: choice.zone, weightKg, partnerId, mode: "store" });
      if (!priced.ok) return { ok: false, error: priced.error, fieldErrors: { delivery: [hub] } };
      fee = priced.delivery.fee;
      label = priced.delivery.label;
      zone = priced.delivery.zone;
    }

    let orderRef: string;
    try {
      orderRef = await generateOrderRef(admin, partnerId);
    } catch {
      return { ok: false, error: "Could not start your order. Please try again." };
    }
    const pickup = choice.method === "walk_in";
    const common = {
      partner_id: partnerId,
      order_ref: orderRef,
      checkout_ref: checkoutRef,
      customer_id: customer?.id ?? null,
      customer_name: d.customerName,
      customer_phone: d.customerPhone,
      customer_email: d.customerEmail || customer?.email || null,
      delivery_address: pickup ? null : d.deliveryAddress,
      location: hub,
      rider: pickup ? "Pickup" : "BNP Fleet",
      channel: "marketplace",
      status: "Created",
      payment_status: "pending",
      payment_ref: reference,
      delivery_method: choice.method,
      delivery_zone: zone,
      delivery_weight_kg: weightKg || null,
      delivery_billed_to: fee > 0 ? "customer" : "none",
    };
    for (const l of group) {
      rows.push({
        ...common,
        product_id: l.productId,
        product_name: l.name,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        subtotal: l.subtotal,
        vat_rate: l.vatRate,
        vat_amount: l.vatAmount,
        total: l.total,
      });
    }
    if (fee > 0) {
      rows.push({ ...common, product_id: null, product_name: label, quantity: 1, unit_price: fee, subtotal: fee, vat_rate: 0, vat_amount: 0, total: fee });
    }
  }

  const { error: insertError } = await admin.from("orders").insert(rows);
  if (insertError) {
    console.error("[marketplace checkout] insert failed", insertError.message);
    return { ok: false, error: "Could not start your order. Please try again." };
  }

  if (customer && d.saveAddress && !allPickup) {
    const supabase = await createSessionClient();
    const { count } = await supabase.from("customer_addresses").select("id", { count: "exact", head: true });
    await supabase.from("customer_addresses").insert({
      customer_id: customer.id,
      label: (count ?? 0) === 0 ? "Home" : "Address",
      full_name: d.customerName,
      phone: d.customerPhone,
      address: d.deliveryAddress,
      is_default: (count ?? 0) === 0,
    });
  }

  const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
  const origin = await getShopOrigin();
  let authorizationUrl: string;
  try {
    const result = await initializeTransaction({
      email: d.customerEmail || customer?.email || `guest+${checkoutRef.toLowerCase()}@bnpfulfillment.com`,
      amountKobo: Math.round(grandTotal * 100),
      reference,
      callbackUrl: `${origin}/confirm`,
      metadata: { checkoutRef, source: "marketplace" },
    });
    authorizationUrl = result.authorizationUrl;
  } catch (err) {
    await admin.from("orders").update({ payment_status: "failed" }).eq("payment_ref", reference);
    return { ok: false, error: err instanceof Error ? err.message : "Could not start payment. Please try again." };
  }
  redirect(authorizationUrl);
}
