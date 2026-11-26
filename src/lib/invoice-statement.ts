import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Invoice } from "@/types/db";
import { STANDARD_CRATE_RATE, standardStorageAmount } from "@/lib/storage";

// Builds the detailed, itemized statement behind a Standard merchant's
// invoice — both finalized invoices (past months) and the live running draft
// for the month in progress. Everything is reconstructed from `orders`, so it
// lines up with what run_monthly_billing (migration 0029) rolled into the
// invoice: fulfillment is 7% of goods DELIVERED in the month, and delivery is
// the BNP delivery fees on merchant-billed orders DISPATCHED in the month.

export type StatementFulfillmentLine = {
  orderRef: string;
  date: string; // delivered_at
  customer: string;
  product: string;
  quantity: number;
  goodsValue: number;
};

export type StatementDeliveryLine = {
  orderRef: string;
  date: string; // dispatched_at
  customer: string;
  method: string | null;
  zone: string | null;
  fee: number;
  /** 'merchant' means BNP fronted this delivery and bills it here. */
  billedTo: "merchant" | "customer" | "none";
};

export type InvoiceStatement = {
  draft: boolean;
  number: string | null;
  period: string; // YYYY-MM-01
  status: "draft" | "pending" | "unpaid" | "paid" | "void";
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  paidVia: string | null;
  partner: {
    id: string;
    businessName: string;
    email: string | null;
    phone: string | null;
  };
  storage: { sqm: number; crates: number; pallets: number; rate: number; crateRate: number; amount: number };
  fulfillment: { rate: number; salesValue: number; amount: number; lines: StatementFulfillmentLine[] };
  /** Standard restock add-on: a flat fee per restock shipment over the threshold (0041). */
  restock: { amount: number; shipments: number; fee: number; threshold: number };
  delivery: { amount: number; bnpFronted: number; lines: StatementDeliveryLine[] };
  total: number;
  walletBalance: number;
  /** Enterprise: detail lives in `lines` (from invoice_lines), not the fixed sections above. */
  itemized: boolean;
  lines: StatementLine[];
};

export type StatementLine = {
  kind: string;
  label: string;
  quantity: number | null;
  unitRate: number | null;
  amount: number;
};

/** First instant of a YYYY-MM period and of the month after it, in Lagos (UTC+1, no DST). */
function periodBounds(period: string): { start: string; end: string } {
  const [y, m] = period.slice(0, 7).split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${y}-${pad(m)}-01T00:00:00+01:00`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const end = `${ny}-${pad(nm)}-01T00:00:00+01:00`;
  return { start, end };
}

/** The first day of the current month, Lagos time, as YYYY-MM-01. */
export function currentPeriod(): string {
  const now = new Date();
  const lagos = new Date(now.getTime() + 60 * 60 * 1000); // shift to UTC+1 wall clock
  return `${lagos.getUTCFullYear()}-${String(lagos.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

type OrderRow = {
  order_ref: string;
  customer_name: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  subtotal: number | null;
  discount_amount: number | null;
  delivered_at: string | null;
  dispatched_at: string | null;
  delivery_fee: number | null;
  delivery_method: string | null;
  delivery_zone: string | null;
  delivery_billed_to: "merchant" | "customer" | "none";
};

const goodsValue = (o: OrderRow) => Math.max(0, Number(o.subtotal ?? 0) - Number(o.discount_amount ?? 0));

/**
 * Builds the statement for one period. Pass a finalized `invoice` for a past
 * month, or just a `period` (YYYY-MM-01) for the live draft of a month that
 * hasn't been billed yet.
 */
export async function buildInvoiceStatement(
  supabase: SupabaseClient,
  opts: { partnerId: string; invoice?: Invoice; period?: string },
): Promise<InvoiceStatement | null> {
  const period = opts.invoice?.period?.slice(0, 10) ?? opts.period;
  if (!period) return null;
  const draft = !opts.invoice;

  // Enterprise invoices carry their detail in invoice_lines, not the fixed
  // storage/fulfillment/delivery columns. Build the statement straight from them.
  if (opts.invoice?.itemized) {
    const inv = opts.invoice;
    const [{ data: partner }, { data: lineRows }] = await Promise.all([
      supabase
        .from("partners")
        .select("id, business_name, email, phone, wallet_balance")
        .eq("id", opts.partnerId)
        .maybeSingle(),
      supabase
        .from("invoice_lines")
        .select("kind, label, quantity, unit_rate, amount, sort")
        .eq("invoice_id", inv.id)
        .order("sort"),
    ]);
    if (!partner) return null;
    const lines: StatementLine[] = (lineRows ?? []).map((l) => ({
      kind: l.kind,
      label: l.label,
      quantity: l.quantity === null ? null : Number(l.quantity),
      unitRate: l.unit_rate === null ? null : Number(l.unit_rate),
      amount: Number(l.amount),
    }));
    return {
      draft: false,
      number: inv.number,
      period,
      status: inv.status,
      issuedAt: inv.issued_at,
      dueAt: inv.due_at,
      paidAt: inv.paid_at,
      paidVia: inv.paid_via,
      partner: {
        id: partner.id,
        businessName: partner.business_name,
        email: partner.email ?? null,
        phone: partner.phone ?? null,
      },
      storage: { sqm: 0, crates: 0, pallets: 0, rate: 0, crateRate: 0, amount: 0 },
      fulfillment: { rate: 0, salesValue: 0, amount: 0, lines: [] },
      restock: { amount: 0, shipments: 0, fee: 0, threshold: 0 },
      delivery: { amount: 0, bnpFronted: 0, lines: [] },
      total: Number(inv.total),
      walletBalance: Number(partner.wallet_balance ?? 0),
      itemized: true,
      lines,
    };
  }

  const { start, end } = periodBounds(period);

  const [{ data: partner }, { data: settings }, { data: orders }, { data: deliveries }] = await Promise.all([
    supabase
      .from("partners")
      .select(
        "id, business_name, email, phone, storage_sqm, storage_crates, storage_pallets, standard_restock_enabled, wallet_balance",
      )
      .eq("id", opts.partnerId)
      .maybeSingle(),
    supabase
      .from("billing_settings")
      .select("storage_rate, crate_m2, std_crate_rate, standard_rate, std_restock_fee, std_restock_threshold")
      .maybeSingle(),
    supabase
      .from("orders")
      .select(
        "order_ref, customer_name, product_id, product_name, quantity, subtotal, discount_amount, delivered_at, dispatched_at, delivery_fee, delivery_method, delivery_zone, delivery_billed_to",
      )
      .eq("partner_id", opts.partnerId)
      .or(`and(delivered_at.gte.${start},delivered_at.lt.${end}),and(dispatched_at.gte.${start},dispatched_at.lt.${end})`),
    // Received shipments up to the period end, oldest first, with unit totals,
    // so we can tell the first-ever intake from later restocks (matches 0041).
    supabase
      .from("inbound_deliveries")
      .select("id, received_at, inbound_delivery_lines(received_qty)")
      .eq("partner_id", opts.partnerId)
      .eq("status", "received")
      .lt("received_at", end)
      .order("received_at", { ascending: true }),
  ]);

  if (!partner) return null;
  const rows = (orders ?? []) as OrderRow[];
  const storageRate = Number(settings?.storage_rate ?? 10000);
  const standardRate = Number(opts.invoice?.fulfillment_rate ?? settings?.standard_rate ?? 0.07);

  // Fulfillment: product lines delivered in the period.
  const fulfillmentLines: StatementFulfillmentLine[] = rows
    .filter((o) => o.product_id && o.delivered_at && o.delivered_at >= start && o.delivered_at < end)
    .map((o) => ({
      orderRef: o.order_ref,
      date: o.delivered_at!,
      customer: o.customer_name,
      product: o.product_name,
      quantity: o.quantity,
      goodsValue: goodsValue(o),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const salesValue = opts.invoice
    ? Number(opts.invoice.sales_value)
    : fulfillmentLines.reduce((s, l) => s + l.goodsValue, 0);
  const fulfillmentAmount = opts.invoice
    ? Number(opts.invoice.fulfillment_amount)
    : Math.round(salesValue * standardRate * 100) / 100;

  // Delivery: BNP fees on merchant-billed orders dispatched in the period.
  // delivery_fee sits on the order's first line only, so filtering fee>0
  // yields one row per order with no double counting.
  const deliveryLines: StatementDeliveryLine[] = rows
    .filter(
      (o) =>
        o.delivery_billed_to === "merchant" &&
        Number(o.delivery_fee ?? 0) > 0 &&
        o.dispatched_at &&
        o.dispatched_at >= start &&
        o.dispatched_at < end,
    )
    .map((o) => ({
      orderRef: o.order_ref,
      date: o.dispatched_at!,
      customer: o.customer_name,
      method: o.delivery_method,
      zone: o.delivery_zone,
      fee: Number(o.delivery_fee),
      billedTo: o.delivery_billed_to,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const deliveryAmount = opts.invoice
    ? Number(opts.invoice.delivery_amount)
    : deliveryLines.reduce((s, l) => s + l.fee, 0);
  const bnpFronted = deliveryLines.reduce((s, l) => s + l.fee, 0);

  const crateRate = Number(settings?.std_crate_rate ?? STANDARD_CRATE_RATE);
  const crateM2 = Number(settings?.crate_m2 ?? 0.25);
  const storageAmount = opts.invoice
    ? Number(opts.invoice.storage_amount)
    : standardStorageAmount({
        crates: Number(partner.storage_crates ?? 0),
        sqm: Number(partner.storage_sqm),
        crateRate,
        crateM2,
        storageRate,
      });

  // Restock add-on: a flat fee on each received shipment over the threshold that
  // is not the merchant's first-ever intake, counted in this period.
  const restockFee = Number(settings?.std_restock_fee ?? 100000);
  const restockThreshold = Number(settings?.std_restock_threshold ?? 200);
  let restockShipments = 0;
  if (partner.standard_restock_enabled) {
    const received = (deliveries ?? []).map((d) => ({
      receivedAt: d.received_at as string | null,
      units: ((d.inbound_delivery_lines as { received_qty: number }[] | null) ?? []).reduce(
        (sum, l) => sum + Number(l.received_qty ?? 0),
        0,
      ),
    }));
    // Index 0 is the first-ever intake; index > 0 are restocks.
    restockShipments = received.filter(
      (d, i) => i > 0 && d.receivedAt && d.receivedAt >= start && d.receivedAt < end && d.units > restockThreshold,
    ).length;
  }
  const restockAmount = opts.invoice
    ? Number(opts.invoice.restock_amount ?? 0)
    : restockShipments * restockFee;

  const total = opts.invoice
    ? Number(opts.invoice.total)
    : Math.round((storageAmount + fulfillmentAmount + restockAmount + deliveryAmount) * 100) / 100;

  return {
    draft,
    number: opts.invoice?.number ?? null,
    period,
    status: opts.invoice ? opts.invoice.status : "draft",
    issuedAt: opts.invoice?.issued_at ?? null,
    dueAt: opts.invoice?.due_at ?? null,
    paidAt: opts.invoice?.paid_at ?? null,
    paidVia: opts.invoice?.paid_via ?? null,
    partner: {
      id: partner.id,
      businessName: partner.business_name,
      email: partner.email ?? null,
      phone: partner.phone ?? null,
    },
    storage: {
      sqm: Number(partner.storage_sqm),
      crates: Number(partner.storage_crates ?? 0),
      pallets: Number(partner.storage_pallets ?? 0),
      rate: storageRate,
      crateRate,
      amount: storageAmount,
    },
    fulfillment: { rate: standardRate, salesValue, amount: fulfillmentAmount, lines: fulfillmentLines },
    restock: { amount: restockAmount, shipments: restockShipments, fee: restockFee, threshold: restockThreshold },
    delivery: { amount: deliveryAmount, bnpFronted, lines: deliveryLines },
    total,
    walletBalance: Number(partner.wallet_balance ?? 0),
    itemized: false,
    lines: [],
  };
}
