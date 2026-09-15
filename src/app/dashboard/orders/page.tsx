import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import {
  deliveredToday,
  isFulfillmentRestricted,
  ordersToday,
  pendingReview,
  revenueInFlight,
} from "@/lib/dashboard-metrics";
import { naira } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/dashboard/ui";
import { OrdersClient } from "./orders-client";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");
  const { partner } = auth;

  const { orders, products } = await getDashboardData(partner.id);
  const restricted = isFulfillmentRestricted(partner);

  return (
    <div>
      <PageHeader title="Orders" description="Every order across all warehouses." />

      {restricted ? (
        <div className="mb-5 rounded-lg bg-destructive px-4 py-3 text-sm font-semibold text-white">
          Fulfillment suspended, wallet is below the {naira(partner.wallet_buffer)}{" "}
          buffer. Top up to create new orders.
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-3">
        <StatCard label="Orders today" value={ordersToday(orders).length} accent="gold" />
        <StatCard
          label="Revenue in flight"
          value={naira(revenueInFlight(orders))}
          accent="teal"
        />
        <StatCard label="Delivered today" value={deliveredToday(orders).length} accent="success" />
        <StatCard
          label="Pending review"
          value={pendingReview(orders).length}
          sub="returned or damaged orders"
          accent="destructive"
        />
      </div>

      <OrdersClient orders={orders} products={products} restricted={restricted} />
    </div>
  );
}
