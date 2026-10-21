"use client";

import { jsPDF } from "jspdf";
import { company } from "@/lib/site-content";
import { drawCode128, fitOneLine } from "@/lib/labels-pdf";

// The 4 x 6 inch label stuck on each packed order. Its barcode is the package
// code (merchant code + order number), which the dispatch screen scans.
// No prices: the label is visible to anyone handling the parcel.

export type PackageLabelData = {
  packageCode: string;
  orderRef: string;
  merchantName: string;
  customerName: string;
  customerPhone: string | null;
  deliveryAddress: string | null;
  rider: string;
  location: string;
  placedAt: string;
  items: { name: string; quantity: number }[];
};

const W = 101.6;
const H = 152.4;
const M = 5;

export function buildPackageLabel(data: PackageLabelData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: "portrait" });
  const inner = W - M * 2;
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(company.name.toUpperCase(), M, M + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(fitOneLine(doc, `Sold by ${data.merchantName}`, inner), M, M + 10);
  doc.text(company.phoneDisplay, W - M, M + 5, { align: "right" });
  let y = M + 13;
  doc.line(M, y, W - M, y);

  // Package barcode
  y += 3;
  drawCode128(doc, data.packageCode, M, y, inner, 24);
  y += 24 + 5;
  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.text(data.packageCode, W / 2, y, { align: "center" });
  y += 4;
  doc.line(M, y, W - M, y);

  // Ship to
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SHIP TO", M, y);
  y += 6.5;
  doc.setFontSize(16);
  doc.text(fitOneLine(doc, data.customerName, inner), M, y);
  if (data.customerPhone) {
    y += 7;
    doc.setFontSize(13);
    doc.text(data.customerPhone, M, y);
  }
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const address = doc.splitTextToSize(data.deliveryAddress || "No address given", inner) as string[];
  for (const line of address.slice(0, 5)) {
    doc.text(line, M, y);
    y += 5;
  }

  // Delivery method, in a box so it's easy to sort parcels by.
  y += 2;
  doc.rect(M, y, inner, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(data.rider.toUpperCase(), M + 3, y + 8.2);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.location} warehouse`, W - M - 3, y + 7.8, { align: "right" });
  y += 12 + 6;

  // Contents
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const units = data.items.reduce((s, i) => s + i.quantity, 0);
  doc.text(`CONTENTS (${units} ITEM${units === 1 ? "" : "S"})`, M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const roomFor = Math.max(1, Math.floor((H - M - 10 - y) / 4.6));
  const shown = data.items.length > roomFor ? data.items.slice(0, roomFor - 1) : data.items;
  for (const item of shown) {
    doc.text(fitOneLine(doc, `${item.quantity} × ${item.name}`, inner), M, y);
    y += 4.6;
  }
  if (shown.length < data.items.length) {
    doc.text(`+ ${data.items.length - shown.length} more product(s)`, M, y);
  }

  // Footer
  doc.line(M, H - M - 6, W - M, H - M - 6);
  doc.setFontSize(8);
  doc.text(`Order ${data.orderRef}`, M, H - M - 1.5);
  doc.text(new Date(data.placedAt).toLocaleDateString("en-NG"), W - M, H - M - 1.5, { align: "right" });
  return doc;
}

/** Opens the label with the print dialog, or downloads it if pop-ups are blocked. */
export function printPackageLabel(data: PackageLabelData) {
  const doc = buildPackageLabel(data);
  doc.autoPrint();
  const tab = window.open(doc.output("bloburl"), "_blank");
  if (!tab) doc.save(`label-${data.packageCode}.pdf`);
}
