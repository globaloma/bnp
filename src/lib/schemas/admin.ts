import { z } from "zod";

export const rewardSchema = z.object({
  partnerId: z.string().uuid("Select a partner"),
  amount: z.coerce.number().min(0).default(0),
  type: z.string().trim().min(2, "Enter a reward type").max(60).default("Reward"),
  reason: z.string().trim().max(300).optional(),
});

export type RewardInput = z.infer<typeof rewardSchema>;

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
