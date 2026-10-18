"use client";

import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";

// Bin and SKU labels for a thermal label printer. Each label is its own PDF
// page sized exactly to the label roll, which is what thermal printer
// drivers expect. Barcodes are drawn as vector bars (not a bitmap), so they
// stay sharp at whatever resolution the printer has.

export const LABEL_SIZES = {
  "50x25": { width: 50, height: 25, name: "50 × 25 mm (small)" },
  "58x40": { width: 58, height: 40, name: "58 × 40 mm" },
  "100x50": { width: 100, height: 50, name: "100 × 50 mm (large)" },
} as const;

export type LabelSizeId = keyof typeof LABEL_SIZES;

export const DEFAULT_LABEL_SIZE: LabelSizeId = "50x25";

/** More pages than this is almost certainly a typo in the copies field. */
export const MAX_LABELS_PER_PRINT = 2000;

export type LabelItem = {
  /** Encoded as Code 128, and printed in plain text under the bars. */
  barcode: string;
  /** Bold line above the barcode: the bin code or the product name. */
  heading: string;
  /** Up to two small lines under the barcode text. */
  details: string[];
  copies: number;
};

// Code 128 needs a blank margin of at least 10 bar widths on each side or
// scanners can miss where the code starts.
const QUIET_ZONE_MODULES = 10;

// One dot of a standard 203 dpi thermal printer. Bars that are a whole
// number of dots wide print evenly; in-between widths get rounded by the
// printer, some bars up and some down, which makes codes harder to scan.
const PRINTER_DOT_MM = 25.4 / 203;

function barcodeModules(value: string): string {
  const target: { encodings?: { data: string }[] } = {};
  JsBarcode(target, value, { format: "CODE128" });
  return (target.encodings ?? []).map((e) => e.data).join("");
}

function fitOneLine(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

// jsPDF font sizes are points; label space is millimetres. A line of text
// takes about 1.2 × the font size.
function ptForLine(mm: number): number {
  return mm / 0.3528 / 1.2;
}

function drawLabel(doc: jsPDF, item: LabelItem, width: number, height: number) {
  const margin = Math.max(1.5, height * 0.07);
  const contentWidth = width - margin * 2;
  const centre = width / 2;

  // Vertical budget, as shares of the usable height.
  const usable = height - margin * 2;
  const headingH = usable * 0.2;
  const gapH = usable * 0.04;
  const barsH = usable * 0.4;
  const valueH = usable * 0.13;
  const detailH = usable * 0.115;

  let y = margin;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  // Shrink a long heading (down to 55%) before cutting it off, so the
  // variant at the end of "Bucket Hat (Red)" survives where it can.
  const headingPt = ptForLine(headingH);
  doc.setFontSize(headingPt);
  const headingWidth = doc.getTextWidth(item.heading);
  if (headingWidth > contentWidth) {
    doc.setFontSize(Math.max(headingPt * 0.55, (headingPt * contentWidth) / headingWidth));
  }
  doc.text(fitOneLine(doc, item.heading, contentWidth), centre, y + headingH * 0.8, {
    align: "center",
  });
  y += headingH + gapH;

  const modules = barcodeModules(item.barcode);
  const fitWidth = contentWidth / (modules.length + QUIET_ZONE_MODULES * 2);
  const dots = Math.floor(fitWidth / PRINTER_DOT_MM);
  // Below two dots, snapping would shrink the code too much; use the fit.
  const moduleWidth = dots >= 2 ? dots * PRINTER_DOT_MM : fitWidth;
  const barsWidth = moduleWidth * modules.length;
  const x = centre - barsWidth / 2;
  doc.setFillColor(0, 0, 0);
  for (let i = 0; i < modules.length; ) {
    if (modules[i] !== "1") {
      i++;
      continue;
    }
    let run = 1;
    while (modules[i + run] === "1") run++;
    doc.rect(x + i * moduleWidth, y, run * moduleWidth, barsH, "F");
    i += run;
  }
  y += barsH;

  doc.setFont("courier", "bold");
  doc.setFontSize(ptForLine(valueH));
  doc.text(fitOneLine(doc, item.barcode, contentWidth), centre, y + valueH * 0.82, {
    align: "center",
  });
  y += valueH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(ptForLine(detailH));
  for (const line of item.details.slice(0, 2)) {
    if (!line) continue;
    doc.text(fitOneLine(doc, line, contentWidth), centre, y + detailH * 0.8, {
      align: "center",
    });
    y += detailH;
  }
}

export function countLabels(items: LabelItem[]): number {
  return items.reduce((sum, i) => sum + Math.max(0, Math.floor(i.copies)), 0);
}

export function buildLabelsPdf(items: LabelItem[], sizeId: LabelSizeId): jsPDF {
  const { width, height } = LABEL_SIZES[sizeId];
  const orientation = width >= height ? "landscape" : "portrait";
  const doc = new jsPDF({ unit: "mm", format: [width, height], orientation });

  let first = true;
  for (const item of items) {
    for (let c = 0; c < Math.floor(item.copies); c++) {
      if (!first) doc.addPage([width, height], orientation);
      first = false;
      drawLabel(doc, item, width, height);
    }
  }
  return doc;
}

/**
 * Opens the labels in a new tab with the print dialog up. Falls back to a
 * download when the browser blocks the new tab.
 */
export function printLabels(items: LabelItem[], sizeId: LabelSizeId, fileName: string) {
  const doc = buildLabelsPdf(items, sizeId);
  doc.autoPrint();
  const url = doc.output("bloburl");
  const tab = window.open(url, "_blank");
  if (!tab) doc.save(fileName);
}
