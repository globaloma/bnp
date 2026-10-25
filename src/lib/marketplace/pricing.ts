import { displayName } from "@/lib/variants";
import type { MarketProduct } from "@/lib/marketplace/data";

// Shop helpers used on both the server and in the browser.

export function discountPercent(p: Pick<MarketProduct, "sale_price" | "promo_price">) {
  if (p.promo_price === null || p.promo_price >= p.sale_price || p.sale_price <= 0) return 0;
  return Math.round(((p.sale_price - p.promo_price) / p.sale_price) * 100);
}

/** Item as it goes in the cart, shared by the tile and the product page. */
export function cartItem(p: MarketProduct) {
  return {
    productId: p.id,
    name: displayName(p),
    price: p.price,
    vat: p.vat,
    shippingFee: 0,
    pickupEnabled: p.location === "Abuja",
    location: p.location,
    imageUrl: p.image_url,
    stock: p.stock,
    partnerId: p.partner_id,
    merchantName: p.merchant_name,
    weightKg: p.weight_kg,
  };
}
