"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LogOut, MapPin, Package, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { customerSignOut } from "@/app/marketplace/account/actions";
import { useShopHref } from "./shop-base";

const ITEMS = [
  { path: "/account", label: "Orders", icon: Package },
  { path: "/account/saved", label: "Saved items", icon: Heart },
  { path: "/account/addresses", label: "Addresses", icon: MapPin },
  { path: "/account/details", label: "Account details", icon: UserRound },
];

export function AccountNav({ name, email }: { name: string; email: string | null }) {
  const href = useShopHref();
  const pathname = usePathname();
  return (
    <aside className="h-fit rounded-lg bg-white p-2">
      <div className="px-3 py-2">
        <p className="truncate text-sm font-semibold text-navy">{name || "My account"}</p>
        {email ? <p className="truncate text-xs text-mist">{email}</p> : null}
      </div>
      <nav className="mt-1 flex flex-row overflow-x-auto md:flex-col">
        {ITEMS.map((item) => {
          const active = pathname === href(item.path) || pathname.endsWith(`/marketplace${item.path}`) || pathname === item.path;
          return (
            <Link
              key={item.path}
              href={href(item.path)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap",
                active ? "bg-cream font-semibold text-navy" : "text-graphite hover:bg-cream",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
        <form action={customerSignOut}>
          <button type="submit" className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap text-graphite hover:bg-cream">
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </nav>
    </aside>
  );
}
