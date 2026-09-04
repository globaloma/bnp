import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Award, Gift } from "lucide-react";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import { naira, formatDate } from "@/lib/format";
import { MILESTONE_TARGET } from "@/types/db";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");

  const { orders, returns, rewards } = await getDashboardData(auth.partner.id);

  const now = new Date();
  const ordersThisMonth = orders.filter((o) => {
    const d = new Date(o.placed_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const pct = Math.min(ordersThisMonth / MILESTONE_TARGET, 1);

  const openReturns = returns.filter(
    (r) => new Date(r.filed_at).getTime() > now.getTime() - 30 * 86_400_000,
  );

  const badges = [
    {
      id: "first_order",
      label: "First shipment",
      desc: "Fulfilled your first order",
      earned: orders.length >= 1,
    },
    {
      id: "10_orders",
      label: "10 orders",
      desc: "Completed 10 fulfillments",
      earned: orders.length >= 10,
    },
    {
      id: "50_orders",
      label: "50 orders",
      desc: "Complete 50 fulfillments",
      earned: orders.length >= 50,
    },
    {
      id: "clean_record",
      label: "Clean record",
      desc: "30 days with no returns",
      earned: openReturns.length === 0,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Rewards"
        description="Milestones, badges and reward history."
      />

      <Panel accent="success" className="mb-5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-navy">This month's milestone</span>
          <span className="text-xs font-semibold text-success">
            {ordersThisMonth}/{MILESTONE_TARGET} orders
          </span>
        </div>
        <div className="h-3 rounded-full bg-stone">
          <div
            className="h-full rounded-full bg-success transition-[width]"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <p className="mt-2.5 text-xs text-graphite">
          Reach {MILESTONE_TARGET} orders in a month to unlock a wallet credit
          and free packaging. Rewards are applied by the BNP team once a
          milestone is hit.
        </p>
      </Panel>

      <Panel className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Badges</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {badges.map((b) => (
            <div
              key={b.id}
              className={cn(
                "rounded-lg p-3.5 text-center",
                b.earned ? "bg-navy" : "bg-stone opacity-60",
              )}
            >
              <Award
                className={cn(
                  "mx-auto size-6",
                  b.earned ? "text-gold" : "text-mist",
                )}
              />
              <div
                className={cn(
                  "mt-1.5 text-xs font-bold",
                  b.earned ? "text-gold" : "text-graphite",
                )}
              >
                {b.label}
              </div>
              <div
                className={cn(
                  "mt-0.5 text-[10px]",
                  b.earned ? "text-mist" : "text-graphite",
                )}
              >
                {b.desc}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-sm font-semibold text-navy">Rewards history</h2>
        {rewards.length === 0 ? (
          <EmptyState
            icon={<Gift className="size-8" />}
            title="No rewards yet"
            body="Hit a milestone and the BNP team will credit your wallet or apply a perk here."
          />
        ) : (
          <div className="flex flex-col">
            {rewards.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border-b border-stone py-2.5 text-sm last:border-b-0"
              >
                <div>
                  <div className="font-medium text-navy">{r.type}</div>
                  <div className="text-[11px] text-mist">
                    {formatDate(r.created_at)} · {r.reason}
                  </div>
                </div>
                {r.amount > 0 ? (
                  <div className="font-semibold text-success">
                    +{naira(r.amount)}
                  </div>
                ) : (
                  <div className="text-xs font-medium text-graphite">
                    Non-monetary
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
