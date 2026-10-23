/** What a customer pays for one unit: the promo price while one is set. */
export function unitPrice(p: { sale_price: number; promo_price?: number | null }): number {
  const promo = p.promo_price === null || p.promo_price === undefined ? null : Number(p.promo_price);
  return promo !== null && promo < Number(p.sale_price) ? promo : Number(p.sale_price);
}

export function onPromo(p: { sale_price: number; promo_price?: number | null }): boolean {
  return unitPrice(p) < Number(p.sale_price);
}
