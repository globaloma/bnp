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
