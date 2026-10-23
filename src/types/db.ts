export type WarehouseLocation = "Abuja" | "Lagos" | "USA";
export type PartnerStatus = "pending" | "active" | "suspended";
export type PartnerRole = "merchant" | "fulfillment_center";
export type OrderStatus =
  | "Created"
  | "Reserved"
  | "Picking"
  | "Packed"
  | "Dispatched"
  | "Delivered"
  | "Returned"
  | "Damaged"
  | "Cancelled";
export type OrderRider = "BNP Fleet" | "Own Rider" | "Pickup";
export type OrderChannel = "dashboard" | "storefront";
export type OrderPaymentStatus = "pending" | "paid" | "failed";
export type OrderDiscountType = "fixed" | "percentage";
export type WalletTxnType = "Top-up" | "Deduction" | "Reward" | "Adjustment";
export type ReturnStatus = "Under Review" | "Approved" | "Rejected" | "Resolved";

export type Partner = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  /** Short unique code prefixed to this merchant's SKU barcodes, e.g. WALK. */
  code: string;
  phone: string | null;
  category: string | null;
  status: PartnerStatus;
  role: PartnerRole;
  is_admin: boolean;
  /** Warehouse accounts only: may approve stock adjustments (admins can too). */
  is_supervisor: boolean;
  /** Merchant plan (Technical Specification v2, section 2). */
  plan_type: "standard" | "enterprise";
  plan_changed_at: string | null;
  /** Floor space the warehouse has measured for this merchant, billed monthly. */
  storage_sqm: number;
  /** Enterprise: name and contact of their account manager. */
  account_manager: string | null;
  /** Standard: an invoice is overdue, so new orders and deliveries pause. */
  billing_locked: boolean;
  /** Enterprise: wallet at or below the minimum, so picking and dispatch pause. */
  orders_paused: boolean;
  wallet_alert: "ok" | "low" | "floor";
  slug: string;
  charges_vat: boolean;
  wallet_balance: number;
  wallet_buffer: number;
  bank_code: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  paystack_recipient_code: string | null;
  logo_url: string | null;
  store_description: string | null;
  store_whatsapp: string | null;
  store_instagram: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  partner_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  cost_price: number;
  sale_price: number;
  /** Lower price customers pay while set (migration 0030). */
  promo_price: number | null;
  vat: number;
  stock: number;
  location: WarehouseLocation;
  shipping_fee: number;
  pickup_enabled: boolean;
  image_url: string | null;
  description: string | null;
  /** Physically in the warehouse. */
  on_hand: number;
  /** Promised to open orders, not yet dispatched. */
  allocated: number;
  /** Received but not yet put away into a bin, so not yet sellable. */
  staged: number;
  /** Returned damaged, held apart until a supervisor writes it off or restocks it. */
  quarantined: number;
  /** Email the merchant when available stock falls to this; null means the default. */
  low_stock_threshold: number | null;
  /** Set once an alert has gone out for the current drop; clears on restock. */
  low_stock_alerted: boolean;
  /** Value per unit, for insurance and stock valuation. Locked once set. */
  declared_value: number | null;
  declared_value_locked_at: string | null;
  /** kg per unit, for weight-priced delivery (migration 0029). */
  weight_kg: number | null;
  /** Colour/size of this SKU, e.g. "Red" or "Large". */
  variant: string | null;
  /** Shared by every variant of the same product. */
  group_id: string | null;
  /** Code 128 value on the SKU label, e.g. WALK-HAT-RED. */
  barcode: string | null;
  /** The merchant's own retail barcode (EAN/UPC), if the item has one. */
  retail_barcode: string | null;
  published: boolean;
  last_moved_at: string;
  created_at: string;
};

export type Invoice = {
  id: string;
  number: string;
  partner_id: string;
  /** First day of the month billed. */
  period: string;
  storage_sqm: number;
  storage_amount: number;
  sales_value: number;
  fulfillment_rate: number;
  fulfillment_amount: number;
  total: number;
  status: "unpaid" | "paid" | "void";
  issued_at: string;
  due_at: string;
  paid_at: string | null;
  paid_via: "wallet" | "paystack" | "admin" | null;
};

export type BillingCharge = {
  id: string;
  partner_id: string;
  kind: "storage" | "insurance" | "fulfillment" | "adjustment" | "delivery";
  period: string | null;
  order_ref: string | null;
  basis: number | null;
  rate: number | null;
  amount: number;
  note: string | null;
  created_at: string;
};

export type InboundStatus = "announced" | "receiving" | "received" | "cancelled";

/** Stock a merchant is sending to a warehouse, received by scanning. */
export type InboundDelivery = {
  id: string;
  ref: string;
  partner_id: string;
  location: WarehouseLocation;
  status: InboundStatus;
  expected_on: string | null;
  note: string | null;
  /** False when the warehouse logged stock that arrived without notice. */
  announced: boolean;
  started_at: string | null;
  received_at: string | null;
  created_at: string;
};

export type InboundDeliveryLine = {
  id: string;
  delivery_id: string;
  product_id: string;
  expected_qty: number;
  received_qty: number;
};

/** What a scan function returns: big green, amber or red on the scan screen. */
export type ScanResult = {
  ok: boolean;
  tone: "success" | "warning" | "error";
  message: string;
  product_id?: string;
  received?: number;
  expected?: number;
  in_bin?: number;
  left?: number;
  /** Product name and variant, from putaway. */
  label?: string;
  /** Pick screen: units picked of the scanned line, and whether the order is done. */
  picked?: number;
  quantity?: number;
  complete?: boolean;
  /** Pick screen, when complete: the package label code. */
  package?: string;
  /** Returns screen: the order line and its good and damaged counts. */
  order_id?: string;
  returned?: number;
  damaged?: number;
};

export type Order = {
  id: string;
  partner_id: string;
  order_ref: string;
  customer_name: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  /** Units scanned into the order on the pick screen. */
  picked_qty: number;
  /** Units scanned back in on the Returns screen, good and damaged. */
  returned_qty: number;
  returned_damaged_qty: number;
  delivered_at: string | null;
  unit_price: number;
  total: number;
  status: OrderStatus;
  location: WarehouseLocation;
  rider: OrderRider;
  channel: OrderChannel;
  payment_status: OrderPaymentStatus;
  payment_ref: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  delivery_address: string | null;
  notes: string | null;
  discount_type: OrderDiscountType | null;
  discount_value: number;
  discount_amount: number;
  vat_rate: number;
  vat_amount: number;
  delivery_fee: number;
  /** Delivery options (migration 0029); null on older orders. */
  delivery_method: "bnp_dispatch" | "gig" | "ups" | "walk_in" | "own_rider" | null;
  delivery_zone: string | null;
  delivery_weight_kg: number | null;
  /** Who pays BNP for the delivery: merchant (on their bill) or customer (at checkout). */
  delivery_billed_to: "merchant" | "customer" | "none";
  tracking_number: string | null;
  pickup_at: string | null;
  dispatched_at: string | null;
  /** Where a dispatched parcel is on the road (migration 0031). */
  delivery_progress: "in_transit" | "failed" | null;
  delivery_progress_at: string | null;
  delivery_failed_attempts: number;
  delivery_failure_note: string | null;
  subtotal: number;
  placed_at: string;
  created_at: string;
  updated_at: string;
};

export type StorefrontPartner = {
  id: string;
  slug: string;
  business_name: string;
  category: string | null;
  charges_vat: boolean;
  logo_url: string | null;
  store_description: string | null;
  store_whatsapp: string | null;
  store_instagram: string | null;
};

export type StorefrontProduct = {
  id: string;
  partner_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  sale_price: number;
  promo_price: number | null;
  vat: number;
  stock: number;
  location: WarehouseLocation;
  shipping_fee: number;
  pickup_enabled: boolean;
  image_url: string | null;
  description: string | null;
  variant: string | null;
  group_id: string | null;
};

export type DeliveryZone = {
  id: string;
  partner_id: string;
  name: string;
  fee: number;
};

export type WalletTransaction = {
  id: string;
  partner_id: string;
  type: WalletTxnType;
  amount: number;
  note: string | null;
  created_at: string;
};

export type ReturnClaim = {
  id: string;
  partner_id: string;
  return_ref: string;
  order_id: string | null;
  order_ref: string | null;
  product_name: string | null;
  reason: string;
  status: ReturnStatus;
  image_url: string | null;
  filed_at: string;
};

export type RewardEvent = {
  id: string;
  partner_id: string;
  type: string;
  amount: number;
  reason: string | null;
  created_at: string;
};

export type PartnerStatusLog = {
  id: string;
  partner_id: string;
  status: PartnerStatus;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
};

export type StockEvent = {
  id: string;
  partner_id: string;
  product_id: string | null;
  product_name: string;
  quantity_added: number;
  created_at: string;
};

export type WalletTopupStatus = "pending" | "paid" | "failed";

export type WalletTopup = {
  id: string;
  partner_id: string;
  amount: number;
  reference: string;
  status: WalletTopupStatus;
  created_at: string;
};

export type WalletWithdrawalStatus = "pending" | "processing" | "success" | "failed";

export type WalletWithdrawal = {
  id: string;
  partner_id: string;
  amount: number;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_code: string | null;
  status: WalletWithdrawalStatus;
  paystack_transfer_code: string | null;
  paystack_reference: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export const LOCATIONS: WarehouseLocation[] = ["Abuja", "Lagos", "USA"];
export const ORDER_STATUSES: OrderStatus[] = [
  "Created",
  "Reserved",
  "Picking",
  "Packed",
  "Dispatched",
  "Delivered",
  "Returned",
  "Damaged",
  "Cancelled",
];
export const LOW_STOCK_THRESHOLD = 3;
export const STALE_DAYS_THRESHOLD = 30;
export const MILESTONE_TARGET = 30;
