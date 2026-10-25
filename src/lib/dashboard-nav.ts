import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Boxes,
  ClipboardList,
  WalletCards,
  Award,
  Undo2,
  FileBarChart,
  Bell,
  Users,
  ClipboardPlus,
  Radio,
  MessageSquareWarning,
  Archive,
  Truck,
  PackagePlus,
  ArrowDownToLine,
  ListChecks,
  Send,
  RotateCcw,
  ClipboardCheck,
  ShieldCheck,
  History,
  Receipt,
  Ruler,
  Banknote,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const dashboardNav: DashboardNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/deliveries", label: "Deliveries", icon: Truck },
  { href: "/dashboard/orders", label: "Orders", icon: ClipboardList },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt },
  { href: "/dashboard/wallet", label: "Wallet", icon: WalletCards },
  { href: "/dashboard/rewards", label: "Rewards", icon: Award },
  { href: "/dashboard/returns", label: "Returns & claims", icon: Undo2 },
  { href: "/dashboard/reports", label: "Reports", icon: FileBarChart },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
];

export const fcDashboardNav: DashboardNavItem[] = [
  { href: "/fc", label: "Overview", icon: LayoutGrid },
  { href: "/fc/orders", label: "Orders", icon: ClipboardList },
  { href: "/fc/receiving", label: "Receiving", icon: PackagePlus },
  { href: "/fc/putaway", label: "Putaway", icon: ArrowDownToLine },
  { href: "/fc/picking", label: "Picking", icon: ListChecks },
  { href: "/fc/dispatch", label: "Dispatch", icon: Send },
  { href: "/fc/returns", label: "Returns", icon: RotateCcw },
  { href: "/fc/counts", label: "Cycle counts", icon: ClipboardCheck },
  { href: "/fc/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/fc/inventory", label: "Inventory", icon: Boxes },
  { href: "/fc/bins", label: "Bins", icon: Archive },
  { href: "/fc/storage", label: "Storage space", icon: Ruler },
  { href: "/fc/stock-log", label: "Stock log", icon: History },
];

export const adminDashboardNav: DashboardNavItem[] = [
  { href: "/admin/live", label: "Live orders", icon: Radio },
  { href: "/admin/orders", label: "Create order", icon: ClipboardPlus },
  { href: "/admin/partners", label: "Partners", icon: Users },
  { href: "/admin/billing", label: "Billing", icon: Banknote },
  { href: "/admin/delivery", label: "Delivery rates", icon: Truck },
  { href: "/admin/rewards", label: "Rewards", icon: Award },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquareWarning },
];

// Nav items (and their icon components) can't cross the server/client
// boundary as props, since icons are function references, not serializable
// data. Server layouts pass this variant string instead, and the client
// shell resolves the actual array itself.
export type DashboardNavVariant = "merchant" | "fc" | "admin";

export const navByVariant: Record<DashboardNavVariant, DashboardNavItem[]> = {
  merchant: dashboardNav,
  fc: fcDashboardNav,
  admin: adminDashboardNav,
};
