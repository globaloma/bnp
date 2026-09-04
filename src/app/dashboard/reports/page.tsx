import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import { naira } from "@/lib/format";
import { LOCATIONS, LOW_STOCK_THRESHOLD, ORDER_STATUSES } from "@/types/db";
import { PageHeader, Panel, StatCard } from "@/components/dashboard/ui";
import { ExportButtons } from "./export-buttons";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");

  const { products, orders, walletTransactions } = await getDashboardData(
    auth.partner.id,
  );

  const totalSales = orders.reduce((s, o) => s + (o.total || 0), 0);
  const fulfilled = orders.filter((o) => o.status === "Delivered").length;
  const returnsCount = orders.filter(
    (o) => o.status === "Returned" || o.status === "Damaged",
  ).length;

  return (
    <div>
      <PageHeader title="Reports" description="Export your data, anytime." />

      <div className="mb-5 flex flex-wrap gap-3">
        <StatCard label="Total revenue" value={naira(totalSales)} sub="all orders" />
        <StatCard label="Fulfilled" value={fulfilled} sub="delivered orders" accent="success" />
        <StatCard label="Returns / damages" value={returnsCount} accent="destructive" />
        <StatCard label="Total SKUs" value={products.length} accent="teal" />
      </div>

      <Panel className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Download reports</h2>
        <ExportButtons
          products={products}
          orders={orders}
          walletTransactions={walletTransactions}
        />
        <p className="mt-2.5 text-xs text-mist">
          Exports are CSV files, compatible with Excel and Google Sheets.
        </p>
      </Panel>

      <Panel className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Inventory by warehouse</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-stone text-[10px] font-bold uppercase tracking-wide text-mist">
                <th className="py-2">Warehouse</th>
                <th className="py-2">SKUs</th>
                <th className="py-2">Total stock</th>
                <th className="py-2">Low stock items</th>
              </tr>
            </thead>
            <tbody>
              {LOCATIONS.map((loc) => {
                const locInv = products.filter((p) => p.location === loc);
                const low = locInv.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);
                return (
                  <tr key={loc} className="border-b border-stone">
                    <td className="py-2">{loc}</td>
                    <td className="py-2">{locInv.length}</td>
                    <td className="py-2">
                      {locInv.reduce((s, p) => s + p.stock, 0)}
                    </td>
                    <td className="py-2 font-semibold text-destructive">
                      {low.length || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-sm font-semibold text-navy">
          Order fulfillment stages
        </h2>
        <div className="flex flex-col gap-3">
          {ORDER_STATUSES.map((s) => {
            const c = orders.filter((o) => o.status === s).length;
            const pct = orders.length ? (c / orders.length) * 100 : 0;
            return (
              <div key={s}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-graphite">{s}</span>
                  <span className="text-mist">{c} orders</span>
                </div>
                <div className="h-1.5 rounded-full bg-stone">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
