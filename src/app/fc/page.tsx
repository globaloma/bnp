import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, PackageSearch } from "lucide-react";
import {
  getAuthedFulfillmentCenter,
  getFcNetworkData,
} from "@/lib/data/fulfillment-center";
import {
  deliveredToday,
  lowStockMerchants,
  ordersToday,
  pendingReview,
  revenueInFlight,
} from "@/lib/fc-metrics";
import { naira, formatDate } from "@/lib/format";
import {
  EmptyState,
  OrderStatusBadge,
  PageHeader,
  Panel,
  StatCard,
} from "@/components/dashboard/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Fulfillment center overview" };

export default async function FcOverviewPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const { products, orders } = await getFcNetworkData();

  const today = ordersToday(orders);
  const delivered = deliveredToday(orders);
  const flagged = pendingReview(orders);
  const lowStock = lowStockMerchants(products);

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`Good to see you, ${auth.fc.contact_name || auth.fc.business_name}. Here's what's happening across every merchant.`}
      />

      {lowStock.length > 0 ? (
        <Panel accent="gold" className="mb-5 bg-gold/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-navy">
            <AlertTriangle className="size-4 text-gold" />
            {lowStock.length} merchant{lowStock.length === 1 ? "" : "s"} low on
            stock
          </div>
          <p className="mt-1 text-xs text-graphite">
            Check inventory and restock before stockouts slow dispatch.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {lowStock.slice(0, 5).map((m) => (
              <li key={m.partner_id} className="text-xs text-graphite">
                <strong className="text-navy">{m.merchant_name}</strong>, {m.count}{" "}
                SKU{m.count === 1 ? "" : "s"} low
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-3">
        <StatCard label="Orders today" value={today.length} accent="gold" />
        <StatCard
          label="Revenue in flight"
          value={naira(revenueInFlight(orders))}
          accent="teal"
        />
        <StatCard
          label="Delivered today"
          value={delivered.length}
          sub={`${delivered.length} order${delivered.length === 1 ? "" : "s"} completed today`}
          accent="success"
        />
        <StatCard
          label="Pending review"
          value={flagged.length}
          sub="returned or damaged orders"
          accent="destructive"
        />
      </div>

      <Panel accent="teal">
        <h2 className="mb-3 text-sm font-semibold text-navy">Today&apos;s orders</h2>
        {today.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="size-8" />}
            title="No order data yet"
            body="Orders placed today across every merchant will show up here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {today.slice(0, 8).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs text-teal">
                      {o.order_ref} · {formatDate(o.placed_at)}
                    </TableCell>
                    <TableCell>{o.merchant_name}</TableCell>
                    <TableCell>{o.customer_name}</TableCell>
                    <TableCell>{o.product_name}</TableCell>
                    <TableCell>{o.location}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
