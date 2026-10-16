"use client";

import { useEffect } from "react";
import { useCart } from "./cart-context";

/** Empties the store's cart once mounted. Rendered after a confirmed payment. */
export function ClearCart() {
  const { clear } = useCart();

  useEffect(() => {
    clear();
    // Once per confirmed payment page, not whenever clear's identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
