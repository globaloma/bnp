import { z } from "zod";

export const topUpSchema = z.object({
  amount: z.coerce.number().min(100, "Enter at least ₦100"),
});

export const bankAccountSchema = z.object({
  bankCode: z.string().min(1, "Select a bank"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a valid 10-digit account number"),
});

export const withdrawSchema = z.object({
  amount: z.coerce.number().min(100, "Enter at least ₦100"),
});

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
