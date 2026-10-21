import type { OrderStatus } from "@/types/db";

// Order statuses and who may move an order between them, from the barcode
// pick-and-pack brief. Stock effects of each status live in the database
// (orders_apply_stock trigger, migration 0022); this file is only the rules
// the app enforces and shows.
//
//   Created     storefront checkout started, not paid yet (no stock held)
//   Reserved    paid / created by the merchant: stock allocated
//   Picking     warehouse is picking it (merchant can no longer edit)
//   Packed      packed and labelled
//   Dispatched  handed to the rider: stock leaves on-hand
//   Delivered   customer has it
//   Returned    came back to the warehouse (on-hand restored)
//   Damaged     lost or damaged after leaving
//   Cancelled   cancelled before picking (reservation released)

/** Stock is held for these, and the merchant can still edit or cancel. */
export const MERCHANT_EDITABLE: OrderStatus[] = ["Created", "Reserved"];

/** Allocated to the order but still in the building. */
export const IN_WAREHOUSE: OrderStatus[] = ["Reserved", "Picking", "Packed"];

/** Still in progress, for "open orders" counts. */
export const OPEN_STATUSES: OrderStatus[] = ["Reserved", "Picking", "Packed", "Dispatched"];

export function merchantCanEdit(status: OrderStatus): boolean {
  return MERCHANT_EDITABLE.includes(status);
}

/**
 * Statuses a merchant may set from the current one. The warehouse handles
 * Picking -> Packed -> Dispatched; merchants cancel before picking starts,
 * and report how it went after it leaves (their own riders included).
 */
export function merchantStatusOptions(current: OrderStatus): OrderStatus[] {
  switch (current) {
    case "Created":
    case "Reserved":
      return [current, "Cancelled"];
    case "Dispatched":
      return ["Dispatched", "Delivered", "Returned", "Damaged"];
    case "Delivered":
      return ["Delivered", "Returned", "Damaged"];
    default:
      return [current];
  }
}

/**
 * Statuses the warehouse may set by hand. Picking, Packed and Dispatched only
 * come from the pick and dispatch scan screens (enforced in the database,
 * migration 0024); by hand, staff can cancel before dispatch and record what
 * happened afterwards.
 */
export function fcStatusOptions(current: OrderStatus): OrderStatus[] {
  switch (current) {
    case "Created":
    case "Reserved":
    case "Picking":
    case "Packed":
      return [current, "Cancelled"];
    case "Dispatched":
      return ["Dispatched", "Delivered", "Returned", "Damaged"];
    case "Delivered":
      return ["Delivered", "Returned", "Damaged"];
    default:
      return [current];
  }
}

/** Badge colours, shared by every order list. */
export const STATUS_BADGE: Record<OrderStatus, string> = {
  Created: "bg-stone text-graphite",
  Reserved: "bg-gold/20 text-navy",
  Picking: "bg-gold text-navy",
  Packed: "bg-sky text-white",
  Dispatched: "bg-teal text-white",
  Delivered: "bg-navy text-white",
  Returned: "bg-coral text-white",
  Damaged: "bg-destructive text-white",
  Cancelled: "bg-stone text-mist line-through",
};

/** Left accent on order cards. */
export const STATUS_ACCENT: Record<OrderStatus, "gold" | "teal" | "none" | "destructive"> = {
  Created: "none",
  Reserved: "gold",
  Picking: "gold",
  Packed: "teal",
  Dispatched: "teal",
  Delivered: "none",
  Returned: "destructive",
  Damaged: "destructive",
  Cancelled: "none",
};
