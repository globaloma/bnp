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
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const dashboardNav: DashboardNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/orders", label: "Orders", icon: ClipboardList },
  { href: "/dashboard/wallet", label: "Wallet", icon: WalletCards },
  { href: "/dashboard/rewards", label: "Rewards", icon: Award },
  { href: "/dashboard/returns", label: "Returns & claims", icon: Undo2 },
  { href: "/dashboard/reports", label: "Reports", icon: FileBarChart },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
];

export const fcDashboardNav: DashboardNavItem[] = [
  { href: "/fc", label: "Overview", icon: LayoutGrid },
  { href: "/fc/orders", label: "Orders", icon: ClipboardList },
  { href: "/fc/inventory", label: "Inventory", icon: Boxes },
];

export const adminDashboardNav: DashboardNavItem[] = [
  { href: "/admin/partners", label: "Partners", icon: Users },
  { href: "/admin/rewards", label: "Rewards", icon: Award },
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
