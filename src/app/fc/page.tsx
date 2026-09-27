import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, Boxes, PackageSearch, ShoppingBag } from "lucide-react";
import {
  getAuthedFulfillmentCenter,
  getFcNetworkData,
  getFcRestockEvents,
  type OrderWithMerchant,
} from "@/lib/data/fulfillment-center";
import {
  deliveredToday,
  lowStockMerchants,
  ordersToday,
  pendingReview,
  revenueInFlight,
} from "@/lib/fc-metrics";
import { groupOrdersByRef } from "@/lib/orders";
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

const NEW_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000;

function recentPaidStorefrontOrders(orders: OrderWithMerchant[]) {
  const now = Date.now();
  return [...groupOrdersByRef(orders).entries()]
    .map(([orderRef, rows]) => ({
      orderRef,
      first: rows[0] as OrderWithMerchant,
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

export default async function FcOverviewPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const { products, orders } = await getFcNetworkData();
  const restockEvents = await getFcRestockEvents();

  const today = ordersToday(orders);
  const delivered = deliveredToday(orders);
  const flagged = pendingReview(orders);
  const lowStock = lowStockMerchants(products);
  const newOrders = recentPaidStorefrontOrders(orders);

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`Good to see you, ${auth.fc.contact_name || auth.fc.business_name}. Here's what's happening across every merchant.`}
      />

      <Panel accent="teal" className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">New orders (last 24h)</h2>
        {newOrders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="size-8" />}
            title="No new storefront orders"
            body="Paid orders from any merchant's storefront will show up here as they come in."
          />
        ) : (
          <ul className="flex flex-col">
            {newOrders.map(({ orderRef, first, itemCount, total }) => (
              <li key={orderRef} className="border-b border-stone py-2.5 last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-navy">
                    {orderRef} · {first.merchant_name}
                  </div>
                  <div className="text-sm font-semibold text-navy">{naira(total)}</div>
                </div>
                <div className="mt-0.5 text-xs text-mist">
                  {first.customer_name} · {itemCount} item{itemCount === 1 ? "" : "s"} ·{" "}
                  {first.location} · placed {formatDate(first.placed_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Recent restocks</h2>
        {restockEvents.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-8" />}
            title="No restocks yet"
            body="When a merchant increases a product's stock, it'll show up here."
          />
        ) : (
          <div className="flex flex-col divide-y divide-stone">
            {restockEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <div>
                  <div className="font-medium text-navy">{event.merchant_name}</div>
                  <div className="text-xs text-mist">
                    {event.product_name} · {formatDate(event.created_at)}
                  </div>
                </div>
                <span className="font-semibold text-success">+{event.quantity_added}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

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
