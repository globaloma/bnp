"use client";

import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import { naira } from "@/lib/format";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/marketing/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";

export function DashboardShell({
  businessName,
  walletAvailable,
  alertCount,
  children,
}: {
  businessName: string;
  walletAvailable: number;
  alertCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-stone">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-navy px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 hover:text-white lg:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-white/10 bg-navy p-0">
              <SheetHeader className="border-b border-white/10">
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <SidebarNav alertCount={alertCount} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Logo />
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <div className="text-[10px] text-mist">Wallet</div>
            <div className="text-sm font-semibold text-gold">
              {naira(walletAvailable)}
            </div>
          </div>
          <span className="hidden h-8 items-center rounded-full bg-white/5 px-3 text-xs font-medium text-mist sm:flex">
            {businessName}
          </span>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="text-mist hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 border-r border-white/10 bg-navy lg:block">
          <SidebarNav alertCount={alertCount} />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
