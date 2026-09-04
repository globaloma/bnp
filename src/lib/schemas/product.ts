import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name").max(140),
  sku: z.string().trim().max(60).optional(),
  category: z.string().trim().max(80).optional(),
  costPrice: z.coerce.number().min(0).default(0),
  salePrice: z.coerce.number().min(0.01, "Enter a sale price"),
  vat: z.coerce.number().min(0).max(100).default(7.5),
  stock: z.coerce.number().int().min(0, "Enter a stock quantity"),
  location: z.enum(["Abuja", "Lagos", "USA"]),
  shippingFee: z.coerce.number().min(0).default(0),
  pickupEnabled: z.coerce.boolean().default(false),
  imageUrl: z.string().trim().max(600).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
