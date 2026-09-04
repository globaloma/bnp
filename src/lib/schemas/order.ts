import { z } from "zod";

export const orderSchema = z.object({
  customerName: z.string().trim().min(2, "Enter a customer name").max(140),
  productId: z.string().uuid("Select a product"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  rider: z.enum(["BNP Fleet", "Own Rider", "Pickup"]),
});

export type OrderInput = z.infer<typeof orderSchema>;

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
