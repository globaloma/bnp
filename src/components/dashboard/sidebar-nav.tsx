"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { dashboardNav } from "@/lib/dashboard-nav";
import { LOCATIONS } from "@/types/db";

export function SidebarNav({
  alertCount,
  onNavigate,
}: {
  alertCount: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-3">
        {dashboardNav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
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
              {item.href === "/dashboard/alerts" && alertCount > 0 ? (
                <span className="flex min-w-4 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {alertCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-lg border-l-2 border-gold bg-gold/10 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mist">
          Warehouses
        </p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {LOCATIONS.map((loc) => (
            <li key={loc} className="flex items-center gap-1.5 text-[12px] text-gold">
              <span className="size-1.5 rounded-full bg-gold" />
              {loc}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
