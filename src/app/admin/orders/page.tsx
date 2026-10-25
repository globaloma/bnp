import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadDeliveryOptions } from "@/lib/delivery-pricing";
import type { DeliveryOptions } from "@/lib/delivery-methods";
import type { Product, WarehouseLocation } from "@/types/db";
import { naira } from "@/lib/format";
import { PageHeader, Panel } from "@/components/dashboard/ui";
import { AdminOrderForm, MerchantPicker } from "./admin-order-form";

export const metadata: Metadata = { title: "Create order" };

export default async function AdminCreateOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { merchant: merchantParam } = await searchParams;
  const merchantId = typeof merchantParam === "string" ? merchantParam : "";

  const supabase = await createClient();
  const { data: merchants } = await supabase
    .from("partners")
    .select("id, business_name, plan_type, charges_vat, billing_locked, wallet_locked, wallet_balance, wallet_buffer")
    .eq("role", "merchant")
    .eq("status", "active")
    .order("business_name");

  const merchant = (merchants ?? []).find((m) => m.id === merchantId) ?? null;

  let products: Product[] = [];
  let deliveryOptions: Partial<Record<WarehouseLocation, DeliveryOptions>> = {};
  if (merchant) {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("partner_id", merchant.id)
      .order("name");
    products = (data ?? []) as Product[];
    const hubs = [...new Set(products.map((p) => p.location))] as WarehouseLocation[];
    deliveryOptions = Object.fromEntries(
      await Promise.all(hubs.map(async (hub) => [hub, await loadDeliveryOptions(supabase, hub, merchant.id)] as const)),
    ) as Partial<Record<WarehouseLocation, DeliveryOptions>>;
  }

  const blocked = merchant
    ? merchant.billing_locked
      ? "This merchant is blocked because an invoice is overdue."
      : merchant.wallet_locked && merchant.plan_type === "enterprise"
        ? `This merchant is blocked because their wallet (${naira(Number(merchant.wallet_balance))}) wasn't funded above their minimum of ${naira(Number(merchant.wallet_buffer))} at month end.`
        : null
    : null;

  return (
    <div>
      <PageHeader
        title="Create order"
        description="Create an order for a merchant. It uses their stock and delivery options, and is marked as created by BNP."
      />

      <Panel className="mb-5 max-w-xl">
        <MerchantPicker
          merchants={(merchants ?? []).map((m) => ({ id: m.id, name: m.business_name }))}
          value={merchant?.id ?? ""}
        />
        {merchantId && !merchant ? (
          <p className="mt-2 text-xs text-destructive">That merchant isn&apos;t active. Choose another.</p>
        ) : null}
      </Panel>

      {merchant ? (
        <Panel className="max-w-xl">
          {blocked ? (
            <p className="mb-4 rounded-md bg-gold/15 px-3 py-2 text-xs font-semibold text-navy">
              {blocked} As an admin you can still create orders for them.
            </p>
          ) : null}
          <AdminOrderForm
            key={merchant.id}
            merchantId={merchant.id}
            products={products}
            chargesVat={merchant.charges_vat}
            deliveryOptions={deliveryOptions}
          />
        </Panel>
      ) : null}
    </div>
  );
}
