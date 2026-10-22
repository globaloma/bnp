import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name").max(140),
  sku: z.string().trim().max(60).optional(),
  category: z.string().trim().max(80).optional(),
  costPrice: z.coerce.number().min(0).default(0),
  salePrice: z.coerce.number().min(0.01, "Enter a sale price"),
  vat: z.coerce.number().min(0).max(100).default(7.5),
  // Units the merchant is sending to the warehouse with a new product. They
  // become an announced delivery; on-hand only changes when it's scanned in.
  incoming: z.coerce.number().int().min(0, "Enter 0 or more").max(100000).default(0),
  variant: z.string().trim().max(60).optional(),
  retailBarcode: z
    .string()
    .trim()
    .regex(/^[0-9]{8,14}$/, "A retail barcode is 8 to 14 digits (EAN/UPC)")
    .optional()
    .or(z.literal("")),
  location: z.enum(["Abuja", "Lagos", "USA"]),
  // Value of one unit, for insurance and stock valuation. Set once, then
  // locked (migration 0028); blank leaves it unset.
  declaredValue: z
    .union([z.literal(""), z.coerce.number().min(0, "Enter 0 or more").max(1_000_000_000)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  // Blank means the platform default (LOW_STOCK_THRESHOLD).
  lowStockThreshold: z
    .union([z.literal(""), z.coerce.number().int().min(0, "Enter 0 or more").max(100000)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  shippingFee: z.coerce.number().min(0).default(0),
  pickupEnabled: z.coerce.boolean().default(false),
  imageUrl: z.string().trim().max(600).optional(),
  description: z.string().trim().max(2000, "Keep the description under 2,000 characters").optional(),
  published: z.coerce.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
