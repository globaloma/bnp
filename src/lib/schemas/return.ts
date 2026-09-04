import { z } from "zod";

export const returnSchema = z.object({
  orderId: z.string().uuid("Select an order"),
  reason: z.string().trim().min(5, "Describe the issue").max(1000),
  imageUrl: z.string().trim().max(600).optional(),
});

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
