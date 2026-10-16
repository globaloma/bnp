"use client";

import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import type { Order } from "@/types/db";
import { formatDate } from "@/lib/format";
import { company } from "@/lib/site-content";
import { createClient } from "@/lib/supabase/client";
import { buildReceiptShareMessage, normalizeNigerianPhone } from "@/lib/receipt";

// The order receipt (invoice) PDF and how it's shared, used by merchants on
// their Orders page and by fulfillment centers on theirs. Runs in the
// browser: jsPDF draws the file client-side.

const NAVY: [number, number, number] = [15, 42, 68];
const GRAPHITE: [number, number, number] = [69, 85, 104];
const MIST: [number, number, number] = [138, 151, 168];
const STONE: [number, number, number] = [234, 228, 216];
const GOLD: [number, number, number] = [232, 160, 32];
const SUCCESS: [number, number, number] = [34, 160, 90];
const DESTRUCTIVE: [number, number, number] = [214, 59, 59];

// jsPDF's built-in fonts only cover WinAnsi and have no Naira glyph - it
// renders as a broken box. "NGN" reads clearly on a printed/PDF receipt
// without pulling in a custom embedded font just for one character.
function nairaPdf(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString("en-NG")}`;
}

// Shared receipt links stay valid for a year, long enough for any customer
// to come back to a receipt, without being permanent public URLs.
const RECEIPT_LINK_SECONDS = 60 * 60 * 24 * 365;

export function buildReceiptPdf({
  orderRef,
  lines,
  payUrl,
  merchantName,
}: {
  orderRef: string;
  lines: Order[];
  /** Adds a "Pay online" button for an unpaid storefront order. */
  payUrl?: string | null;
  /** Shown as "Sold by" when someone other than the merchant issues it. */
  merchantName?: string;
}): jsPDF {
  const first = lines[0];
  const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const discount = lines.reduce((sum, l) => sum + l.discount_amount, 0);
  const vat = lines.reduce((sum, l) => sum + l.vat_amount, 0);
  const delivery = lines.reduce((sum, l) => sum + l.delivery_fee, 0);
  const total = lines.reduce((sum, l) => sum + l.total, 0);

  const doc = new jsPDF();
  const left = 14;
  const right = 196;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(company.name, left, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAPHITE);
  doc.text(company.website, left, 26);
  doc.text(company.email, left, 30.5);
  doc.text(company.phoneDisplay, left, 35);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text("Invoice", right, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAPHITE);
  doc.text("Headquarters", right, 26, { align: "right" });
  doc.text(company.primaryHub.area, right, 30.5, { align: "right" });
  doc.text(company.primaryHub.city, right, 35, { align: "right" });

  doc.setDrawColor(...STONE);
  doc.line(left, 40, right, 40);

  if (merchantName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MIST);
    doc.text("SOLD BY", left, 47);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(merchantName, left, 52);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(`Order number: ${orderRef}`, right, 47, { align: "right" });

  const canvas = document.createElement("canvas");
  JsBarcode(canvas, orderRef, { format: "CODE128", displayValue: false, height: 40, margin: 0 });
  const barcodeWidth = 55;
  const barcodeHeight = 11;
  doc.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    right - barcodeWidth,
    50,
    barcodeWidth,
    barcodeHeight,
  );

  let y = 70;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MIST);
  doc.text("SHIPPED TO", left, y);
  doc.text("DATE CREATED", 90, y);
  doc.text("TOTAL TO PAY", right, y, { align: "right" });
  y += 5.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(first.customer_name, left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAPHITE);
  doc.text(formatDate(first.placed_at), 90, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(nairaPdf(total), right, y, { align: "right" });

  let leftY = y + 5;
  if (first.delivery_address) {
    const addressLines = doc.splitTextToSize(first.delivery_address, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAPHITE);
    doc.text(addressLines, left, leftY);
    leftY += addressLines.length * 4;
  }
  if (first.customer_phone) {
    doc.text(first.customer_phone, left, leftY);
    leftY += 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MIST);
  doc.text("STATUS", 90, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...(first.payment_status === "paid" ? SUCCESS : DESTRUCTIVE));
  doc.text(
    first.payment_status === "paid" ? "Paid" : first.payment_status === "failed" ? "Payment failed" : "Unpaid",
    90,
    y + 9.5,
  );

  let rightY = y + 6;
  if (payUrl) {
    const btnWidth = 32;
    const btnHeight = 7;
    doc.setFillColor(...GOLD);
    doc.roundedRect(right - btnWidth, rightY, btnWidth, btnHeight, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Pay online", right - btnWidth / 2, rightY + 4.7, { align: "center" });
    doc.link(right - btnWidth, rightY, btnWidth, btnHeight, { url: payUrl });
    rightY += btnHeight + 4;
  }

  y = Math.max(leftY, y + 14, rightY) + 4;
  doc.setDrawColor(...STONE);
  doc.line(left, y, right, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MIST);
  doc.text("ITEM DETAIL", left, y);
  doc.text("QTY", 130, y, { align: "center" });
  doc.text("RATE", 163, y, { align: "right" });
  doc.text("AMOUNT", right, y, { align: "right" });
  y += 3;
  doc.setDrawColor(...STONE);
  doc.line(left, y, right, y);
  y += 6;

  for (const line of lines) {
    const nameLines = doc.splitTextToSize(line.product_name, 95);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(nameLines, left, y);
    doc.setTextColor(...GRAPHITE);
    doc.text(String(line.quantity), 130, y, { align: "center" });
    doc.text(nairaPdf(line.unit_price), 163, y, { align: "right" });
    doc.setTextColor(...NAVY);
    doc.text(nairaPdf(line.total), right, y, { align: "right" });
    y += Math.max(nameLines.length, 1) * 5 + 2;
  }

  doc.setDrawColor(...STONE);
  doc.line(left, y, right, y);
  y += 7;

  const totalsRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 9.5);
    doc.setTextColor(...(bold ? NAVY : GRAPHITE));
    doc.text(label, 140, y);
    doc.text(value, right, y, { align: "right" });
    y += bold ? 7 : 6;
  };

  totalsRow("Subtotal", nairaPdf(subtotal));
  if (discount > 0) totalsRow("Discount", `-${nairaPdf(discount)}`);
  if (vat > 0) totalsRow(`Tax : VAT (${first.vat_rate}%)`, nairaPdf(vat));
  if (delivery > 0) totalsRow("Shipping Fee", nairaPdf(delivery));
  doc.setDrawColor(...STONE);
  doc.line(140, y - 4, right, y - 4);
  totalsRow("Total", nairaPdf(total), true);

  const pageHeight = doc.internal.pageSize.getHeight();
  if (company.bankAccount) {
    // Sits just above the footer. A receipt long enough to reach it
    // leaves the section off rather than overlapping the totals.
    const bankY = Math.max(y + 6, pageHeight - 46);
    if (bankY + 16 < pageHeight - 22) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MIST);
      doc.text("PAYMENT DETAILS", left, bankY);
      doc.setFontSize(9);
      doc.setTextColor(...GRAPHITE);
      doc.text(`Bank: ${company.bankAccount.bankName}`, left, bankY + 5.5);
      doc.text(`Account number: ${company.bankAccount.accountNumber}`, left, bankY + 10.5);
      doc.text(`Account name: ${company.bankAccount.accountName}`, left, bankY + 15.5);
    }
  }

  doc.setDrawColor(...STONE);
  doc.line(left, pageHeight - 22, right, pageHeight - 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GRAPHITE);
  doc.text("Thank you for doing business with us", 105, pageHeight - 15, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MIST);
  doc.text(company.website, 105, pageHeight - 10, { align: "center" });

  return doc;
}

/**
 * Sends the receipt as a PDF, never as pasted text. On phones the PDF file
 * itself goes through the share sheet (pick WhatsApp or Gmail there). On
 * computers, where WhatsApp and mail links can't carry attachments, the PDF
 * is uploaded to the sender's own folder in the private receipts bucket and
 * the message carries a signed link to it, with the customer's number or
 * email already filled in.
 *
 * Must be called straight from a click: the WhatsApp tab is opened before
 * any await so the browser doesn't block it as a popup.
 */
export async function shareReceipt({
  channel,
  orderRef,
  lines,
  makePdf,
}: {
  channel: "whatsapp" | "email";
  orderRef: string;
  lines: Order[];
  makePdf: () => Promise<jsPDF> | jsPDF;
}): Promise<void> {
  const first = lines[0];
  const isPhone = window.matchMedia("(pointer: coarse)").matches;
  const popup = channel === "whatsapp" && !isPhone ? window.open("", "_blank") : null;
  try {
    const doc = await makePdf();
    const blob = doc.output("blob");
    const file = new File([blob], `${orderRef}.pdf`, { type: "application/pdf" });
    const subject = `Your receipt ${orderRef}`;

    if (isPhone && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: subject,
          text: buildReceiptShareMessage(orderRef, lines),
        });
        return;
      } catch (err) {
        // Closing the share sheet without picking an app isn't an error.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // NotAllowedError means building the PDF took long enough that the
        // browser no longer counts this as a tap; fall back to a link.
        if (!(err instanceof DOMException && err.name === "NotAllowedError")) throw err;
      }
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Your session expired, sign in again.");

    // Storage rules only allow writing into your own folder.
    const path = `${user.id}/${orderRef}-${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(path, blob, { contentType: "application/pdf" });
    if (uploadError) throw uploadError;

    const { data: signed, error: signError } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, RECEIPT_LINK_SECONDS);
    if (signError || !signed) throw signError ?? new Error("Could not create the receipt link");

    const message = buildReceiptShareMessage(orderRef, lines, signed.signedUrl);
    if (channel === "whatsapp") {
      const phone = normalizeNigerianPhone(first.customer_phone);
      const url = `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(message)}`;
      if (popup) popup.location.replace(url);
      else window.open(url, "_blank");
    } else {
      window.location.assign(
        `mailto:${first.customer_email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
      );
    }
  } catch (err) {
    popup?.close();
    throw err;
  }
}
