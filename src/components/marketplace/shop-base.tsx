"use client";

import { createContext, useContext, type ReactNode } from "react";

// Client side of getShopBase(): "" on shop.<domain>, "/marketplace" on the
// main domain. Every marketplace link goes through useShopHref().

const ShopBaseContext = createContext("/marketplace");

export function ShopBaseProvider({ base, children }: { base: string; children: ReactNode }) {
  return <ShopBaseContext.Provider value={base}>{children}</ShopBaseContext.Provider>;
}

export function useShopHref() {
  const base = useContext(ShopBaseContext);
  return (path: string) => (path === "/" ? base || "/" : `${base}${path}`);
}
