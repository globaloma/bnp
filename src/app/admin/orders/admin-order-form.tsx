"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, WarehouseLocation } from "@/types/db";
import type { DeliveryOptions } from "@/lib/delivery-methods";
import { CreateOrderForm } from "@/app/dashboard/orders/orders-client";
import { createOrderForMerchant } from "./actions";

export function MerchantPicker({ merchants, value }: { merchants: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite">
      Merchant
      <select
        value={value}
        onChange={(e) => router.push(e.target.value ? `/admin/orders?merchant=${e.target.value}` : "/admin/orders")}
        className="mt-1.5 block h-10 w-full appearance-none rounded-md border border-stone bg-white px-3 text-sm font-normal normal-case tracking-normal text-navy"
      >
        <option value="">Choose a merchant</option>
        {merchants.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminOrderForm({
  merchantId,
  products,
  chargesVat,
  deliveryOptions,
}: {
  merchantId: string;
  products: Product[];
  chargesVat: boolean;
  deliveryOptions: Partial<Record<WarehouseLocation, DeliveryOptions>>;
}) {
  const router = useRouter();
  // A fresh, empty form after each order.
  const [round, setRound] = useState(0);
  return (
    <CreateOrderForm
      key={round}
      products={products}
      chargesVat={chargesVat}
      deliveryOptions={deliveryOptions}
      action={createOrderForMerchant.bind(null, merchantId)}
      onDone={() => {
        setRound((n) => n + 1);
        router.refresh();
      }}
    />
  );
}
