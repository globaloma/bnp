import { quote } from "@/lib/site-content";

// Storage and fulfillment cost estimate, shared by the quote calculator and
// the worked examples on the pricing page.

export type QuoteInput = {
  /** Shelf floor space in square metres. */
  sqm: number;
  /** Value of goods sold through BNP in a month, in naira. */
  monthlySales: number;
};

export type QuoteEstimate = {
  sqm: number;
  storagePerMonth: number;
  fulfillmentPerMonth: number;
  monthly: number;
  subscriptionPerYear: number;
  firstYear: number;
  /** First year total spread over 12 months, subscription included. */
  averagePerMonth: number;
};

/** Storage is charged per whole square metre, with a minimum of one. */
export function billableSqm(sqm: number): number {
  return Math.min(quote.maxSqm, Math.max(quote.minSqm, Math.ceil(sqm)));
}

export function sqmForCartons(cartons: number): number {
  return billableSqm(cartons / quote.cartonsPerSqm);
}

export function estimateQuote({ sqm, monthlySales }: QuoteInput): QuoteEstimate {
  const space = billableSqm(sqm);
  const sales = Math.max(0, Math.min(quote.maxMonthlySales, monthlySales));
  const storagePerMonth = space * quote.storagePerSqmPerMonth;
  const fulfillmentPerMonth = Math.round(sales * quote.fulfillmentRate);
  const monthly = storagePerMonth + fulfillmentPerMonth;
  const firstYear = quote.subscriptionPerYear + monthly * 12;
  return {
    sqm: space,
    storagePerMonth,
    fulfillmentPerMonth,
    monthly,
    subscriptionPerYear: quote.subscriptionPerYear,
    firstYear,
    averagePerMonth: Math.round(firstYear / 12),
  };
}

export const exampleMerchants = [
  { name: "Just starting", detail: "About 15 cartons, ₦300,000 sales a month", sqm: 2, monthlySales: 300_000 },
  { name: "Growing brand", detail: "About 40 cartons, ₦1.5m sales a month", sqm: 5, monthlySales: 1_500_000 },
  { name: "Established", detail: "About 120 cartons, ₦5m sales a month", sqm: 15, monthlySales: 5_000_000 },
] as const;
