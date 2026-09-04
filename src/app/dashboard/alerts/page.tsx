import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard } from "lucide-react";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import {
  isWalletLow,
  lowStockProducts,
  staleProducts,
  walletAvailable,
} from "@/lib/dashboard-metrics";
import { formatDate, naira } from "@/lib/format";
import { PageHeader, Panel } from "@/components/dashboard/ui";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");
  const { partner } = auth;

  const { products } = await getDashboardData(partner.id);
  const lowStock = lowStockProducts(products);
  const stale = staleProducts(products);
  const walletLow = isWalletLow(partner);

  return (
    <div>
      <PageHeader title="Alerts" description="Everything that needs your attention." />

      {walletLow ? (
        <Panel accent="destructive" className="mb-5 bg-destructive/5">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-destructive">
            <CreditCard className="size-4" />
            Low wallet alert
          </div>
          <p className="text-xs text-graphite">
            Available balance is {naira(walletAvailable(partner))}, below{" "}
            {naira(10000)}. Top up to avoid fulfillment suspension when the
            buffer is breached.
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
