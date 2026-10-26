import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getShopBase } from "@/lib/marketplace/shop";
import { naira } from "@/lib/format";
import { OrderStatusBadge } from "@/components/dashboard/ui";
import type { OrderStatus } from "@/types/db";

export const metadata: Metadata = { title: "My orders" };

type Line = {
  partner_id: string;
  order_ref: string;
  placed_at: string;
  status: OrderStatus;
  payment_status: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  total: number;
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [base, supabase, sp] = await Promise.all([getShopBase(), createClient(), searchParams]);
  const { data } = await supabase
    .from("orders")
    .select("partner_id, order_ref, placed_at, status, payment_status, product_id, product_name, quantity, total")
    .neq("payment_status", "failed")
    .order("placed_at", { ascending: false })
    .limit(500);
  const lines = (data ?? []) as Line[];

  // One card per order (a seller's parcel).
  const orders = new Map<string, Line[]>();
  for (const l of lines) orders.set(`${l.partner_id}:${l.order_ref}`, [...(orders.get(`${l.partner_id}:${l.order_ref}`) ?? []), l]);

  return (
    <div className="rounded-lg bg-white">
      {sp.password === "updated" ? (
        <p className="border-b border-stone bg-success/10 px-4 py-2.5 text-sm text-navy">Your password has been changed.</p>
      ) : null}
      <h1 className="border-b border-stone px-4 py-3 text-lg font-semibold text-navy">Orders</h1>
      {orders.size === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <Package className="size-10 text-mist" />
          <p className="mt-3 font-semibold text-navy">No orders yet</p>
          <Link href={base || "/"} className="mt-3 text-sm font-semibold text-teal-700 hover:underline">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-stone">
          {[...orders.values()].map((group) => {
            const first = group[0];
            const goods = group.filter((l) => l.product_id);
            const items = goods.length > 0 ? goods : group;
            const live = items.filter((l) => l.status !== "Cancelled");
            const status = (live[0] ?? items[0]).status;
            return (
              <li key={`${first.partner_id}:${first.order_ref}`} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-teal-700">{first.order_ref}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-navy">
                    {items.map((i) => `${i.product_name}${i.quantity > 1 ? ` x ${i.quantity}` : ""}`).join(", ")}
                  </p>
                  <p className="text-xs text-mist">
                    {new Date(first.placed_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                    {naira(group.reduce((s, l) => s + Number(l.total), 0))}
                    {first.payment_status === "pending" ? " · awaiting payment" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <OrderStatusBadge status={status} />
                  {goods.map((g) =>
                    g.status === "Delivered" && g.product_id ? (
                      <Link key={g.product_id} href={`${base}/p/${g.product_id}#reviews`} className="text-xs font-semibold text-teal-700 hover:underline">
                        Review {g.product_name.length > 24 ? "item" : g.product_name}
                      </Link>
                    ) : null,
                  )}
                  <Link href={`${base}/track?ref=${encodeURIComponent(first.order_ref)}`} className="text-xs font-semibold text-graphite hover:underline">
                    Track
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
