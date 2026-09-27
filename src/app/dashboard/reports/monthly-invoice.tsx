"use client";

import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Download } from "lucide-react";
import type { Order } from "@/types/db";
import { naira } from "@/lib/format";
import { Button } from "@/components/ui/button";

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
  });
}

export function MonthlyInvoice({
  orders,
  businessName,
}: {
  orders: Order[];
  businessName: string;
}) {
  const currentMonthKey = monthKey(new Date().toISOString());

  const eligibleMonths = useMemo(() => {
    const months = new Set<string>();
    for (const order of orders) {
      if (order.status !== "Delivered") continue;
      const key = monthKey(order.placed_at);
      // A month only becomes available once it's fully over - starting
      // the 1st of the following month, not before.
      if (key < currentMonthKey) months.add(key);
    }
    return Array.from(months).sort().reverse();
  }, [orders, currentMonthKey]);

  const [selectedMonth, setSelectedMonth] = useState(eligibleMonths[0] ?? "");

  function handleDownload() {
    if (!selectedMonth) return;
    const monthOrders = orders.filter(
      (o) => o.status === "Delivered" && monthKey(o.placed_at) === selectedMonth,
    );
    const total = monthOrders.reduce((sum, o) => sum + o.total, 0);

    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(14);
    doc.text(`${businessName} - ${monthLabel(selectedMonth)} invoice`, 14, y);
    y += 10;
    doc.setFontSize(10);
    doc.text("Order ref", 14, y);
    doc.text("Date", 70, y);
    doc.text("Customer", 105, y);
    doc.text("Total", 180, y, { align: "right" });
    y += 4;
    doc.line(14, y, 196, y);
    y += 6;

    for (const order of monthOrders) {
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      doc.text(order.order_ref, 14, y);
      doc.text(new Date(order.placed_at).toLocaleDateString("en-NG"), 70, y);
      doc.text(order.customer_name.slice(0, 28), 105, y);
      doc.text(naira(order.total), 180, y, { align: "right" });
      y += 6;
    }

    y += 4;
    doc.line(14, y, 196, y);
    y += 8;
    doc.setFontSize(12);
    doc.text(`Total (${monthOrders.length} delivered orders)`, 14, y);
    doc.text(naira(total), 180, y, { align: "right" });

    doc.save(`${businessName.replace(/\s+/g, "-")}-${selectedMonth}-invoice.pdf`);
  }

  if (eligibleMonths.length === 0) {
    return (
      <p className="text-sm text-mist">
        No completed month has delivered orders yet - an invoice becomes
        available on the 1st of the month after your first delivered order.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
        className="h-9 rounded-md border border-stone bg-white px-2.5 text-sm text-navy"
      >
        {eligibleMonths.map((key) => (
          <option key={key} value={key}>
            {monthLabel(key)}
          </option>
        ))}
      </select>
      <Button type="button" variant="secondary" onClick={handleDownload}>
        <Download className="size-4" />
        Download invoice
      </Button>
    </div>
  );
}
