import type { Metadata } from "next";
import { CartView } from "@/components/marketplace/cart-view";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <div className="container-page py-5">
      <CartView />
    </div>
  );
}
