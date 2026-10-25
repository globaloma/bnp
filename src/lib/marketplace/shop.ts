import "server-only";
import { headers } from "next/headers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

/**
 * Prefix for marketplace links: "" on shop.<domain>, "/marketplace" on the
 * main domain (set by src/proxy.ts).
 */
export async function getShopBase(): Promise<string> {
  const h = await headers();
  return h.get("x-shop-base") ?? "/marketplace";
}

/** Absolute URL of the shop for this request, for Paystack and email links. */
export async function getShopOrigin(): Promise<string> {
  const h = await headers();
  const base = h.get("x-shop-base") ?? "/marketplace";
  if (base === "") {
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
    if (host) return `${proto}://${host}`;
  }
  return defaultShopOrigin();
}

/** The shop's address when there's no request to read it from (webhooks, emails). */
export function defaultShopOrigin(): string {
  return process.env.NEXT_PUBLIC_SHOP_URL ?? `${SITE_URL}/marketplace`;
}
