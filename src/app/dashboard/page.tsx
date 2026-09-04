import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, PackageSearch } from "lucide-react";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import {
  isFulfillmentRestricted,
  lowStockProducts,
  staleProducts,
  walletAvailable,
} from "@/lib/dashboard-metrics";
import { naira } from "@/lib/format";
import { MILESTONE_TARGET } from "@/types/db";
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
import { WarehouseSplit } from "@/components/dashboard/warehouse-split";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardOverviewPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");
  const { partner } = auth;

  const { products, orders } = await getDashboardData(partner.id);

  const restricted = isFulfillmentRestricted(partner);
  const lowStock = lowStockProducts(products);
  const stale = staleProducts(products);
  const ordersThisMonth = countThisMonth(orders.map((o) => o.placed_at));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${partner.business_name}.`}
      />

      {restricted ? (
        <div className="mb-5 flex items-center gap-3 rounded-lg bg-destructive px-4 py-3 text-sm font-semibold text-white">
          <AlertTriangle className="size-4 shrink-0" />
          Fulfillment access restricted, your wallet balance has fallen below
          the {naira(partner.wallet_buffer)} buffer. Top up to resume.
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-3">
        <StatCard
          label="Available balance"
          value={naira(walletAvailable(partner))}
          sub={`after ${naira(partner.wallet_buffer)} buffer`}
          dark
        />
        <StatCard
          label="Total SKUs"
          value={products.length}
          sub="across all warehouses"
          accent="teal"
        />
        <StatCard label="Orders this month" value={ordersThisMonth} accent="gold" />
        <StatCard
          label="Milestone progress"
          value={`${ordersThisMonth}/${MILESTONE_TARGET}`}
          sub="orders to next reward"
          accent="success"
        />
      </div>

      {lowStock.length > 0 || stale.length > 0 ? (
        <Panel accent="destructive" className="mb-5 bg-destructive/5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            Active alerts
          </div>
          <ul className="flex flex-col gap-1.5">
            {lowStock.map((p) => (
              <li key={p.id} className="text-xs text-graphite">
                <strong className="text-navy">{p.name}</strong>, {p.stock} units
                left at {p.location}
              </li>
            ))}
            {stale.map((p) => (
              <li key={p.id} className="text-xs text-graphite">
                <strong className="text-navy">{p.name}</strong>, no movement in
                30+ days ({p.location})
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Panel accent="teal" className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-navy">Recent orders</h2>
          {orders.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="size-8" />}
              title="No orders yet"
              body="Orders you create will show up here as they move through fulfillment."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Stage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(0, 5).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs text-teal">
                        {o.order_ref}
                      </TableCell>
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

        <Panel>
          <h2 className="mb-3 text-sm font-semibold text-navy">Warehouse split</h2>
          <WarehouseSplit products={products} />
        </Panel>
      </div>
    </div>
  );
}

function countThisMonth(dates: string[]): number {
  const now = new Date();
  return dates.filter((d) => {
    const date = new Date(d);
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }).length;
}
