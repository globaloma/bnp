import { z } from "zod";

export const topUpSchema = z.object({
  amount: z.coerce.number().min(100, "Enter at least ₦100"),
});

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
