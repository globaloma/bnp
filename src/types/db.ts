export type WarehouseLocation = "Abuja" | "Lagos" | "USA";
export type PartnerStatus = "pending" | "active" | "suspended";
export type PartnerRole = "merchant" | "fulfillment_center";
export type OrderStatus =
  | "Packaging"
  | "Shipping"
  | "Delivered"
  | "Returned"
  | "Damaged";
export type OrderRider = "BNP Fleet" | "Own Rider" | "Pickup";
export type OrderChannel = "dashboard" | "storefront";
export type OrderPaymentStatus = "pending" | "paid" | "failed";
export type OrderDiscountType = "fixed" | "percentage";
export type WalletTxnType = "Top-up" | "Deduction" | "Reward";
export type ReturnStatus = "Under Review" | "Approved" | "Rejected" | "Resolved";

export type Partner = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  category: string | null;
  status: PartnerStatus;
  role: PartnerRole;
  is_admin: boolean;
  slug: string;
  wallet_balance: number;
  wallet_buffer: number;
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
  vat: number;
  stock: number;
  location: WarehouseLocation;
  shipping_fee: number;
  pickup_enabled: boolean;
  image_url: string | null;
  published: boolean;
  last_moved_at: string;
  created_at: string;
};

export type Order = {
  id: string;
  partner_id: string;
  order_ref: string;
  customer_name: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
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
};

export type StorefrontProduct = {
  id: string;
  partner_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  sale_price: number;
  vat: number;
  stock: number;
  location: WarehouseLocation;
  shipping_fee: number;
  pickup_enabled: boolean;
  image_url: string | null;
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

export const LOCATIONS: WarehouseLocation[] = ["Abuja", "Lagos", "USA"];
export const ORDER_STATUSES: OrderStatus[] = [
  "Packaging",
  "Shipping",
  "Delivered",
  "Returned",
  "Damaged",
];
export const LOW_STOCK_THRESHOLD = 3;
export const STALE_DAYS_THRESHOLD = 30;
export const MILESTONE_TARGET = 30;
