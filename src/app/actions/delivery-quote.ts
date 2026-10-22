"use server";

import { z } from "zod";
import { liveGigFee } from "@/lib/delivery-pricing";
import { withinRateLimit } from "@/lib/spam-guard";

// Price preview for live GIG delivery on the New order form and store
// checkout. Only a preview: the order is priced again when it's saved.

const input = z.object({
  hub: z.enum(["Abuja", "Lagos"]),
  zone: z.string().trim().min(1).max(120),
  weightKg: z.number().min(0).max(100000),
});

const cache = new Map<string, { fee: number | null; expires: number }>();

export async function quoteGig(raw: z.input<typeof input>): Promise<{ fee: number | null }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { fee: null };
  const { hub, zone, weightKg } = parsed.data;
  const key = `${hub}|${zone}|${Math.ceil(weightKg * 2) / 2}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return { fee: hit.fee };
  if (!(await withinRateLimit("quote"))) return { fee: null };
  const fee = await liveGigFee(hub, zone, weightKg);
  cache.set(key, { fee, expires: Date.now() + 30 * 60 * 1000 });
  return { fee };
}
