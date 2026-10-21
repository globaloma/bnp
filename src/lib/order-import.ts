import type { OrderRider } from "@/types/db";

// Row checks for the CSV order upload, kept free of database calls so they
// can be tested on their own. See src/app/dashboard/orders/import-actions.ts.

export type ImportRow = {
  /** 1-based line in the file, counting the header as line 1. */
  line: number;
  order_group?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  delivery_address?: string;
  sku?: string;
  quantity?: string;
  delivery?: string;
  delivery_fee?: string;
  notes?: string;
};

export type ImportProduct = {
  id: string;
  name: string;
  variant: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
};

export type CheckedRow<P extends ImportProduct> = {
  line: number;
  group: string;
  customer: string;
  product: string;
  quantity: number | null;
  ok: boolean;
  reason?: string;
  orderRef?: string;
  row: ImportRow;
  item?: P;
  rider: OrderRider;
  fee: number;
};

const RIDERS: Record<string, OrderRider> = {
  "bnp fleet": "BNP Fleet",
  bnp: "BNP Fleet",
  "own rider": "Own Rider",
  own: "Own Rider",
  pickup: "Pickup",
  "pick up": "Pickup",
};
const PHONE = /^[0-9+()\s-]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const clean = (v: string | undefined, max = 500) => (v ?? "").trim().slice(0, max);

/**
 * Checks every row, then groups rows into orders. A group with any bad row
 * is held back entirely. Returns null when the file has no filled-in rows.
 */
export function checkImportRows<P extends ImportProduct>(
  rows: ImportRow[],
  products: P[],
): { checked: CheckedRow<P>[]; goodGroups: CheckedRow<P>[][] } | null {
  const bySku = new Map<string, P>();
  for (const p of products) {
    if (p.sku) bySku.set(p.sku.trim().toUpperCase(), p);
    if (p.barcode) bySku.set(p.barcode.toUpperCase(), p);
  }
  const label = (p: P) => (p.variant ? `${p.name} (${p.variant})` : p.name);
  type Checked = CheckedRow<P>;

  // Rows left blank in the template (no customer, no quantity) are skipped.
  const used = rows.filter((r) => clean(r.customer_name) || clean(r.quantity) || clean(r.customer_phone));
  if (used.length === 0) return null;

  // Check each row on its own, counting stock used by earlier rows. Rows of
  // an order that ends up held back shouldn't use up stock, so the check
  // repeats without them until nothing changes.
  let heldBack = new Set<number>();
  for (let pass = 0; pass < 5; pass++) {
  const left = new Map(products.map((p) => [p.id, p.stock]));
  const checked: Checked[] = used.map((r) => {
    const group = clean(r.order_group, 60) || `row-${r.line}`;
    const customer = clean(r.customer_name, 140);
    const sku = clean(r.sku, 80).toUpperCase();
    const product = sku ? bySku.get(sku) : undefined;
    const qtyText = clean(r.quantity, 10);
    const qty = /^\d+$/.test(qtyText) ? Number(qtyText) : null;
    const riderText = clean(r.delivery, 20).toLowerCase();
    const rider = riderText ? RIDERS[riderText] : "BNP Fleet";
    const feeText = clean(r.delivery_fee, 12);
    const fee = feeText ? Number(feeText.replace(/[,₦\s]/g, "")) : 0;
    const phone = clean(r.customer_phone, 20);
    const email = clean(r.customer_email, 160);
    const address = clean(r.delivery_address);

    const base = {
      line: r.line,
      group,
      customer: customer || "(no name)",
      product: product ? label(product) : sku || "(no SKU)",
      quantity: qty,
      row: r,
      rider: rider ?? "BNP Fleet",
      fee: Number.isFinite(fee) ? fee : 0,
    };
    const bad = (reason: string): Checked => ({ ...base, ok: false, reason, item: product });

    if (!sku) return bad("Missing SKU.");
    if (!product) return bad(`Unknown SKU ${sku}. Use one from your template.`);
    if (!qtyText) return bad("Missing quantity.");
    if (qty === null || qty < 1) return bad(`Quantity must be a whole number of at least 1, not "${qtyText}".`);
    if (customer.length < 2) return bad("Missing customer name.");
    if (!phone) return bad("Missing phone number.");
    if (!PHONE.test(phone)) return bad(`"${phone}" doesn't look like a phone number.`);
    if (email && !EMAIL.test(email)) return bad(`"${email}" isn't a valid email.`);
    if (!rider) return bad(`Delivery must be BNP Fleet, Own Rider or Pickup, not "${clean(r.delivery, 20)}".`);
    if (rider !== "Pickup" && !address) return bad("Missing delivery address.");
    if (!Number.isFinite(fee) || fee < 0) return bad(`Delivery fee "${feeText}" isn't a valid amount.`);
    const available = left.get(product.id) ?? 0;
    if (qty > available) {
      return bad(
        available === 0
          ? `Not enough stock: ${label(product)} has none available.`
          : `Not enough stock: only ${available} of ${label(product)} available.`,
      );
    }
    if (!heldBack.has(r.line)) left.set(product.id, available - qty);
    return { ...base, ok: true, item: product };
  });

  // Group rows into orders. Customer details come from the group's first
  // row; a later row that disagrees is flagged.
  const groups = new Map<string, Checked[]>();
  for (const c of checked) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  for (const list of groups.values()) {
    const first = list[0];
    for (const c of list.slice(1)) {
      if (!c.ok) continue;
      const sameCustomer =
        clean(c.row.customer_name).toLowerCase() === clean(first.row.customer_name).toLowerCase() &&
        clean(c.row.customer_phone) === clean(first.row.customer_phone);
      if (!sameCustomer) {
        c.ok = false;
        c.reason = `Different customer from line ${first.line} in the same order_group.`;
      }
    }
    if (list.some((c) => !c.ok)) {
      for (const c of list) {
        if (c.ok) {
          c.ok = false;
          c.reason = "Held back: another line of this order has a problem.";
        }
      }
    }
  }

  const nextHeld = new Set(checked.filter((c) => c.reason?.startsWith("Held back")).map((c) => c.line));
  const stable = nextHeld.size === heldBack.size && [...nextHeld].every((l) => heldBack.has(l));
  if (stable || pass === 4) {
    const goodGroups = [...groups.values()].filter((list) => list.every((c) => c.ok));
    return { checked, goodGroups };
  }
  heldBack = nextHeld;
  }
  return null;
}
