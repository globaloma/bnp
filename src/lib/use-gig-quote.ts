"use client";

import { useEffect, useState } from "react";
import { quoteGig } from "@/app/actions/delivery-quote";
import { needsLiveQuote, type DeliveryMethod, type DeliveryOptions } from "@/lib/delivery-methods";

/**
 * Live GIG price for the current choice, fetched from the server after the
 * merchant or customer stops typing. `fee` is null until there's a price.
 */
export function useGigQuote(
  options: DeliveryOptions | undefined,
  method: DeliveryMethod | null,
  zone: string,
  weightKg: number,
): { live: boolean; fee: number | null; loading: boolean } {
  const live = Boolean(options && method && needsLiveQuote(options, method));
  const hub = options?.hub;
  const key = live && zone && hub && hub !== "USA" ? `${hub}|${zone}|${weightKg}` : "";
  const [result, setResult] = useState<{ key: string; fee: number | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [h, z, w] = key.split("|");
    const timer = setTimeout(async () => {
      const r = await quoteGig({ hub: h as "Abuja" | "Lagos", zone: z, weightKg: Number(w) }).catch(() => ({ fee: null }));
      if (!cancelled) setResult({ key, fee: r.fee });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  const current = result && result.key === key ? result : null;
  return { live, fee: current?.fee ?? null, loading: Boolean(key) && !current };
}
