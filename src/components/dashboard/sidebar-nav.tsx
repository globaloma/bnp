"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { dashboardNav, type DashboardNavItem } from "@/lib/dashboard-nav";

export function SidebarNav({
  items = dashboardNav,
  alertCount,
  alertHref = "/dashboard/alerts",
  footer,
  onNavigate,
}: {
  items?: DashboardNavItem[];
  alertCount?: number;
  alertHref?: string;
  footer?: ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-3">
        {items.map((item) => {
          const active =
            item.href === "/dashboard" || item.href === "/fc"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center justify-between gap-2 border-l-2 px-4 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-transparent text-mist hover:bg-white/5 hover:text-white",
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="size-4" strokeWidth={1.8} />
                {item.label}
              </span>
              {item.href === alertHref && alertCount && alertCount > 0 ? (
                <span className="flex min-w-4 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {alertCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {footer}
    </div>
  );
}
