"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Copy, ExternalLink, LogOut, Settings } from "lucide-react";
import { dashboardNav } from "@/lib/dashboard-nav";
import { LOCATIONS } from "@/types/db";
import { Logo } from "@/components/marketing/logo";
import { Button } from "@/components/ui/button";
import { StatCard, Panel, PageHeader, OrderStatusBadge } from "@/components/dashboard/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/db";

// A self-playing preview of the real merchant dashboard: the actual shell,
// sidebar, stat cards, panels, status badges and storefront link, auto-cycling
// through a few screens (Dashboard -> Inventory -> Orders). Stands in as the
// "demo video" until real footage exists, and reuses the dashboard's own
// components so it matches the product exactly.

const VIEWS = ["/dashboard", "/dashboard/inventory", "/dashboard/orders"] as const;
const STORE_URL = "bnpfulfillment.com/store/bellas-beauty";

const RECENT_ORDERS: { ref: string; customer: string; item: string; location: string; status: OrderStatus }[] = [
  { ref: "ORD-1042", customer: "Amara T.", item: "Vitamin C Serum", location: "Abuja", status: "Dispatched" },
  { ref: "ORD-1041", customer: "Chidi O.", item: "Shea Butter 200ml", location: "Lagos", status: "Packed" },
  { ref: "ORD-1040", customer: "Ngozi A.", item: "Rose Toner", location: "Abuja", status: "Delivered" },
  { ref: "ORD-1039", customer: "Bola S.", item: "Jade Face Roller", location: "Abuja", status: "Reserved" },
];

const INVENTORY: { name: string; location: string; stock: number }[] = [
  { name: "Vitamin C Serum", location: "Abuja", stock: 48 },
  { name: "Shea Butter 200ml", location: "Lagos", stock: 22 },
  { name: "Rose Toner", location: "Abuja", stock: 3 },
  { name: "Jade Face Roller", location: "Abuja", stock: 64 },
  { name: "Clay Mask", location: "Abuja", stock: 0 },
];

const SPLIT: { location: string; pct: number }[] = [
  { location: "Abuja", pct: 68 },
  { location: "Lagos", pct: 24 },
  { location: "USA", pct: 8 },
];

function StockBadge({ stock }: { stock: number }) {
  const tone =
    stock <= 0
      ? "bg-destructive/10 text-destructive"
      : stock <= 3
        ? "bg-gold/20 text-navy"
        : "bg-success/15 text-success";
  const label = stock <= 0 ? "Out of stock" : stock <= 3 ? "Low stock" : "In stock";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase", tone)}>
      {label}
    </span>
  );
}

function DashboardView() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Welcome back, Bella's Beauty." />
      <div className="mb-5 flex flex-wrap gap-3">
        <StatCard label="Available balance" value="₦182,400" sub="in your wallet" dark />
        <StatCard label="Total SKUs" value={34} sub="across all warehouses" accent="teal" />
        <StatCard label="Orders this month" value={76} accent="gold" />
        <StatCard label="Milestone progress" value="76/100" sub="orders to next reward" accent="success" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel accent="teal" className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-navy">Recent orders</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RECENT_ORDERS.map((o) => (
                <TableRow key={o.ref}>
                  <TableCell className="font-mono text-xs text-teal">{o.ref}</TableCell>
                  <TableCell>{o.customer}</TableCell>
                  <TableCell>{o.item}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel>
          <h2 className="mb-3 text-sm font-semibold text-navy">Warehouse split</h2>
          <ul className="flex flex-col gap-3">
            {SPLIT.map((s) => (
              <li key={s.location}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-navy">{s.location}</span>
                  <span className="tabular-nums text-graphite">{s.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${s.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function InventoryView() {
  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Products stored across your warehouses."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden max-w-[240px] truncate rounded-md border border-stone bg-white px-3 py-1.5 text-xs text-graphite md:inline-block">
              {STORE_URL}
            </span>
            <Button type="button" variant="outline" size="sm">
              <Copy className="size-3.5" />
              Copy link
            </Button>
            <Button type="button" variant="secondary" size="sm">
              <ExternalLink className="size-3.5" />
              View storefront
            </Button>
          </div>
        }
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {INVENTORY.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium text-navy">{p.name}</TableCell>
                <TableCell className="text-graphite">{p.location}</TableCell>
                <TableCell className="tabular-nums">{p.stock} units</TableCell>
                <TableCell>
                  <StockBadge stock={p.stock} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

function OrdersView() {
  return (
    <div>
      <PageHeader title="Orders" description="Every order, from reserved to delivered." />
      <Panel accent="teal">
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
            {RECENT_ORDERS.map((o) => (
              <TableRow key={o.ref}>
                <TableCell className="font-mono text-xs text-teal">{o.ref}</TableCell>
                <TableCell>{o.customer}</TableCell>
                <TableCell>{o.item}</TableCell>
                <TableCell className="text-graphite">{o.location}</TableCell>
                <TableCell>
                  <OrderStatusBadge status={o.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

export function OperationDemo({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setI((n) => (n + 1) % VIEWS.length), 3600);
    return () => clearInterval(id);
  }, [reduce]);

  const current = VIEWS[i];

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-navy/15 bg-navy shadow-[0_40px_90px_-40px_rgba(15,42,68,0.7)]",
        className,
      )}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="ml-3 rounded-md bg-white/5 px-3 py-1 text-xs font-medium text-mist">
          bnpfulfillment.com{current === "/dashboard" ? "/dashboard" : current}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300">
          <motion.span
            className="size-2 rounded-full bg-emerald-400"
            animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          Live
        </span>
      </div>

      {/* Dashboard replica */}
      <div className="bg-stone">
        {/* Top bar */}
        <header className="flex h-12 items-center justify-between border-b border-white/10 bg-navy px-4">
          <Logo />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-[10px] text-mist">Wallet</div>
              <div className="text-sm font-semibold text-gold">₦182,400</div>
            </div>
            <span className="hidden h-7 items-center rounded-full bg-white/5 px-3 text-xs font-medium text-mist sm:flex">
              Bella&apos;s Beauty
            </span>
            <Settings className="size-4 text-mist" />
            <LogOut className="size-4 text-mist" />
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden w-48 shrink-0 flex-col border-r border-white/10 bg-navy sm:flex">
            <nav className="flex flex-1 flex-col gap-0.5 py-2">
              {dashboardNav.map((item) => {
                const active = item.href === current;
                const Icon = item.icon;
                return (
                  <div
                    key={item.href}
                    className={cn(
                      "flex items-center gap-2.5 border-l-2 px-4 py-2 text-[13px] font-medium transition-colors duration-300",
                      active ? "border-gold bg-gold/10 text-gold" : "border-transparent text-mist",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={1.8} />
                    {item.label}
                  </div>
                );
              })}
            </nav>
            {/* Warehouses footer, exactly as in the real sidebar */}
            <div className="m-3 rounded-lg border-l-2 border-gold bg-gold/10 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mist">Warehouses</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {LOCATIONS.map((loc) => (
                  <li key={loc} className="flex items-center gap-1.5 text-[12px] text-gold">
                    <span className="size-1.5 rounded-full bg-gold" />
                    {loc}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main content */}
          <main className="min-h-[460px] min-w-0 flex-1 p-4 sm:p-6">
            <motion.div
              key={current}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {current === "/dashboard" ? (
                <DashboardView />
              ) : current === "/dashboard/inventory" ? (
                <InventoryView />
              ) : (
                <OrdersView />
              )}
            </motion.div>
          </main>
        </div>
      </div>

      {/* Progress dots */}
      {!reduce ? (
        <div className="flex justify-center gap-1.5 bg-navy pb-3" aria-hidden>
          {VIEWS.map((v, n) => (
            <span
              key={v}
              className={cn("h-1 rounded-full transition-all duration-300", n === i ? "w-6 bg-gold" : "w-1.5 bg-white/20")}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
