"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Back + Download/Print controls above an invoice document. Hidden when printing. */
export function InvoiceActionsBar() {
  return (
    <div className="no-print mb-4 flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" render={<Link href="/dashboard/billing" />}>
        <ArrowLeft className="size-4" />
        Back to billing
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="size-4" />
        Download / Print
      </Button>
    </div>
  );
}
