import { quote } from "@/lib/site-content";

// Storage and fulfillment cost estimate for the STANDARD plan — shared by the
// Standard quote calculator and the worked examples on the pricing page.
// Enterprise is custom-quoted and has its own calculator (enterprise-cost-calculator).
//
// Standard storage is priced per standard box (530 x 290 x 370mm). The rate
// card is ₦10,000 for every 2 boxes a month, i.e. ₦5,000 per box, so the cost
// is simply the number of boxes times the per-box rate.

export type QuoteInput = {
  /** Number of standard boxes (530 x 290 x 370mm) stored with us. */
  boxes: number;
  /** Value of goods sold through BNP in a month, in naira. */
  monthlySales: number;
};

export type QuoteEstimate = {
  boxes: number;
  storagePerMonth: number;
  fulfillmentRate: number;
  fulfillmentPerMonth: number;
  monthly: number;
  subscriptionPerYear: number;
  firstYear: number;
  /** First year total spread over 12 months, registration fee included. */
  averagePerMonth: number;
};

/** Clamp the box count to the supported range, whole boxes only. */
export function billableBoxes(boxes: number): number {
  return Math.min(quote.maxBoxes, Math.max(quote.minBoxes, Math.round(boxes)));
}

export function estimateQuote({ boxes, monthlySales }: QuoteInput): QuoteEstimate {
  const count = billableBoxes(boxes);
  const sales = Math.max(0, Math.min(quote.maxMonthlySales, monthlySales));
  const rate = quote.fulfillmentRate;
  const storagePerMonth = count * quote.storagePerBoxPerMonth;
  const fulfillmentPerMonth = Math.round(sales * rate);
  const monthly = storagePerMonth + fulfillmentPerMonth;
  const firstYear = quote.subscriptionPerYear + monthly * 12;
  return {
    boxes: count,
    storagePerMonth,
    fulfillmentRate: rate,
    fulfillmentPerMonth,
    monthly,
    subscriptionPerYear: quote.subscriptionPerYear,
    firstYear,
    averagePerMonth: Math.round(firstYear / 12),
  };
}

export const exampleMerchants = [
  { name: "Just starting", detail: "About 6 boxes, ₦300,000 sales a month", boxes: 6, monthlySales: 300_000 },
  { name: "Growing brand", detail: "About 20 boxes, ₦1.5m sales a month", boxes: 20, monthlySales: 1_500_000 },
  { name: "Established", detail: "About 60 boxes, ₦5m sales a month", boxes: 60, monthlySales: 5_000_000 },
] as const;
