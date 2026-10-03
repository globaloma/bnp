import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard, ShoppingBag } from "lucide-react";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import {
  isWalletLow,
  lowStockProducts,
  staleProducts,
  walletAvailable,
} from "@/lib/dashboard-metrics";
import { groupOrdersByRef } from "@/lib/orders";
import { formatDate, naira } from "@/lib/format";
import { PageHeader, Panel } from "@/components/dashboard/ui";

export const metadata: Metadata = { title: "Alerts" };

const NEW_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000;

function recentPaidStorefrontOrders(orders: Parameters<typeof groupOrdersByRef>[0]) {
  const now = Date.now();
  return [...groupOrdersByRef(orders).entries()]
    .map(([orderRef, rows]) => ({
      orderRef,
      first: rows[0],
      itemCount: rows.length,
      total: rows.reduce((sum, r) => sum + r.total, 0),
    }))
    .filter(
      ({ first }) =>
        first.channel === "storefront" &&
        first.payment_status === "paid" &&
        now - new Date(first.placed_at).getTime() < NEW_ORDER_WINDOW_MS,
    )
    .sort((a, b) => new Date(b.first.placed_at).getTime() - new Date(a.first.placed_at).getTime());
}

export default async function AlertsPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");
  const { partner } = auth;

  const { products, orders } = await getDashboardData(partner.id);
  const lowStock = lowStockProducts(products);
  const stale = staleProducts(products);
  const walletLow = isWalletLow(partner);

  const newOrders = recentPaidStorefrontOrders(orders);

  return (
    <div>
      <PageHeader title="Alerts" description="Everything that needs your attention." />

      <Panel accent="teal" className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">New orders (last 24h)</h2>
        {newOrders.length === 0 ? (
          <NoAlerts text="No new storefront orders in the last 24 hours." />
        ) : (
          <ul className="flex flex-col">
            {newOrders.map(({ orderRef, first, itemCount, total }) => (
              <li key={orderRef} className="border-b border-stone py-2.5 last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-navy">
                    {orderRef} · {first.customer_name}
                  </div>
                  <div className="text-sm font-semibold text-navy">{naira(total)}</div>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-mist">
                  <ShoppingBag className="size-3.5" />
                  {itemCount} item{itemCount === 1 ? "" : "s"} · placed {formatDate(first.placed_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {walletLow ? (
        <Panel accent="destructive" className="mb-5 bg-destructive/5">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-destructive">
            <CreditCard className="size-4" />
            Low wallet alert
          </div>
          <p className="text-xs text-graphite">
            Available balance is {naira(walletAvailable(partner))}, below{" "}
            {naira(10000)}. Top up to avoid fulfillment suspension when it
            runs out.
          </p>
        </Panel>
      ) : null}

      <Panel accent="destructive" className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-destructive">Low stock</h2>
        {lowStock.length === 0 ? (
          <NoAlerts text="All products are sufficiently stocked." />
        ) : (
          <ul className="flex flex-col">
            {lowStock.map((p) => (
              <li key={p.id} className="border-b border-stone py-2.5 last:border-b-0">
                <div className="text-sm font-semibold text-navy">{p.name}</div>
                <div className="text-xs text-mist">
                  {p.location} · SKU {p.sku || "-"} · {p.stock} units remaining
                </div>
                <div className="mt-0.5 text-xs font-semibold text-destructive">
                  Restock soon to avoid failed orders.
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel accent="gold">
        <h2 className="mb-3 text-sm font-semibold text-navy">
          Stale inventory (30+ days)
        </h2>
        {stale.length === 0 ? (
          <NoAlerts text="No stale inventory detected." />
        ) : (
          <ul className="flex flex-col">
            {stale.map((p) => (
              <li key={p.id} className="border-b border-stone py-2.5 last:border-b-0">
                <div className="text-sm font-semibold text-navy">{p.name}</div>
                <div className="text-xs text-mist">
                  {p.location} · Last moved {formatDate(p.last_moved_at)}
                </div>
                <div className="mt-0.5 text-xs text-graphite">
                  Consider a promotion to clear this stock.
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function NoAlerts({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-graphite">
      <CheckCircle2 className="size-4 text-success" />
      {text}
    </p>
  );
}
