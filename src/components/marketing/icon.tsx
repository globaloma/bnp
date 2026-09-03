import {
  BarChart3,
  Bike,
  ClipboardList,
  CreditCard,
  FileBarChart,
  Footprints,
  Globe,
  MonitorSmartphone,
  Package,
  PackageCheck,
  Rocket,
  ShieldCheck,
  Smartphone,
  Store,
  TrendingUp,
  Truck,
  Undo2,
  Warehouse,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

const registry = {
  BarChart3,
  Bike,
  ClipboardList,
  CreditCard,
  FileBarChart,
  Footprints,
  Globe,
  MonitorSmartphone,
  Package,
  PackageCheck,
  Rocket,
  ShieldCheck,
  Smartphone,
  Store,
  TrendingUp,
  Truck,
  Undo2,
  Warehouse,
  Wallet,
  Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof registry;

export function Icon({
  name,
  className,
}: {
  name: IconName | string;
  className?: string;
}) {
  const Cmp = registry[name as IconName] ?? Package;
  return <Cmp className={className} strokeWidth={1.6} aria-hidden />;
}
