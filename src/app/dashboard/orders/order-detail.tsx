"use client";

import { useActionState, useState, useTransition } from "react";
import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import { toast } from "sonner";
import { Download, MessageCircle, Mail, Pencil, Trash2, CreditCard } from "lucide-react";
import type { Order, OrderStatus } from "@/types/db";
import { ORDER_STATUSES } from "@/types/db";
import { naira, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { company } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderStatusBadge } from "@/components/dashboard/ui";
import { buildReceiptText, normalizeNigerianPhone } from "@/lib/receipt";
import { computeOrderTotals } from "@/lib/orders";
import { editOrder, deleteOrderLine, deleteOrderGroup, getOrderPaymentLink } from "./actions";
import type { ActionResult } from "@/lib/schemas/order";

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

const fieldClass =
  "h-9 w-full rounded-md border border-stone bg-white px-2.5 text-xs text-navy outline-none transition-colors focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function OrderDetail({
  orderRef,
  lines,
  chargesVat,
  onClose,
}: {
  orderRef: string;
  lines: Order[];
  chargesVat: boolean;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteLine, setConfirmDeleteLine] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [pending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const [payingOnline, setPayingOnline] = useState(false);

  const first = lines[0];
  const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const discount = lines.reduce((sum, l) => sum + l.discount_amount, 0);
  const vat = lines.reduce((sum, l) => sum + l.vat_amount, 0);
  const delivery = lines.reduce((sum, l) => sum + l.delivery_fee, 0);
  const total = lines.reduce((sum, l) => sum + l.total, 0);

  function handleDeleteLine(orderId: string) {
    startTransition(async () => {
      const result = await deleteOrderLine(orderId);
      if (result.ok) {
        toast.success("Item removed");
        setConfirmDeleteLine(null);
        if (lines.length === 1) onClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDeleteGroup() {
    startTransition(async () => {
      const result = await deleteOrderGroup(orderRef);
      if (result.ok) {
        toast.success("Order deleted");
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handlePayOnline() {
    setPayingOnline(true);
    const result = await getOrderPaymentLink(orderRef);
    setPayingOnline(false);
    if (result.ok) {
      window.open(result.url, "_blank");
    } else {
      toast.error(result.error);
    }
  }

  async function handleDownloadPdf() {
    setDownloading(true);

    let payUrl: string | null = null;
    if (first.channel === "storefront" && first.payment_status === "pending") {
      const result = await getOrderPaymentLink(orderRef);
      if (result.ok) payUrl = result.url;
    }

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

    doc.save(`${orderRef}.pdf`);
    setDownloading(false);
  }

  function handleShareWhatsApp() {
    const text = buildReceiptText(orderRef, lines);
    const phone = normalizeNigerianPhone(first.customer_phone);
    const url = `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  function handleShareEmail() {
    const text = buildReceiptText(orderRef, lines);
    const subject = `Your receipt ${orderRef}`;
    const url = `mailto:${first.customer_email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = url;
  }

  return (
    <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="rounded-lg border border-stone bg-card p-3 text-xs">
        <div className="font-semibold text-navy">{first.customer_name}</div>
        {first.customer_phone ? <div className="text-mist">{first.customer_phone}</div> : null}
        {first.customer_email ? <div className="text-mist">{first.customer_email}</div> : null}
        {first.delivery_address ? (
          <div className="mt-1 text-graphite">{first.delivery_address}</div>
        ) : null}
        {first.notes ? (
          <div className="mt-1 text-graphite italic">&ldquo;{first.notes}&rdquo;</div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {lines.map((line) =>
          editingId === line.id ? (
            <EditLineForm
              key={line.id}
              line={line}
              chargesVat={chargesVat}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <div key={line.id} className="rounded-lg border border-stone bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-navy">
                    {line.product_name} × {line.quantity}
                  </div>
                  <div className="text-[11px] text-mist">
                    {naira(line.unit_price)} each
                    {line.discount_amount > 0 ? ` · discount -${naira(line.discount_amount)}` : ""}
                    {line.vat_amount > 0 ? ` · VAT ${naira(line.vat_amount)}` : ""}
                    {line.delivery_fee > 0 ? ` · delivery ${naira(line.delivery_fee)}` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <OrderStatusBadge status={line.status} />
                  <span className="text-sm font-semibold text-navy">{naira(line.total)}</span>
                </div>
              </div>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingId(line.id)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                >
                  <Pencil className="size-3" />
                  Edit
                </button>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteLine(line.id)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-destructive hover:underline"
                  >
                    <Trash2 className="size-3" />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="rounded-lg border border-stone bg-white p-3 text-sm">
        <div className="flex justify-between text-graphite">
          <span>Subtotal</span>
          <span>{naira(subtotal)}</span>
        </div>
        {discount > 0 ? (
          <div className="flex justify-between text-graphite">
            <span>Discount</span>
            <span>-{naira(discount)}</span>
          </div>
        ) : null}
        {vat > 0 ? (
          <div className="flex justify-between text-graphite">
            <span>VAT</span>
            <span>{naira(vat)}</span>
          </div>
        ) : null}
        {delivery > 0 ? (
          <div className="flex justify-between text-graphite">
            <span>Delivery</span>
            <span>{naira(delivery)}</span>
          </div>
        ) : null}
        <div className="mt-1.5 flex justify-between border-t border-stone pt-1.5 font-semibold text-navy">
          <span>Total</span>
          <span>{naira(total)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={downloading} onClick={handleDownloadPdf}>
          <Download className="size-3.5" />
          {downloading ? "Preparing..." : "PDF"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleShareWhatsApp}>
          <MessageCircle className="size-3.5" />
          WhatsApp
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleShareEmail}>
          <Mail className="size-3.5" />
          Email
        </Button>
        {first.channel === "storefront" && first.payment_status === "pending" ? (
          <Button type="button" variant="outline" size="sm" disabled={payingOnline} onClick={handlePayOnline}>
            <CreditCard className="size-3.5" />
            {payingOnline ? "Preparing..." : "Pay online"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => setConfirmDeleteGroup(true)}
          className="ml-auto"
        >
          <Trash2 className="size-3.5" />
          Delete order
        </Button>
      </div>

      <Dialog open={confirmDeleteLine !== null} onOpenChange={(v) => !v && setConfirmDeleteLine(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove this item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-graphite">
            This removes it from the order and restocks it. This can&apos;t be undone.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteLine(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => confirmDeleteLine && handleDeleteLine(confirmDeleteLine)}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteGroup} onOpenChange={setConfirmDeleteGroup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this order?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-graphite">
            This deletes every item in order {orderRef} and restocks them. This can&apos;t be
            undone.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteGroup(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={handleDeleteGroup}>
              Delete order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditLineForm({
  line,
  chargesVat,
  onDone,
}: {
  line: Order;
  chargesVat: boolean;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState(line.quantity);
  const [rider, setRider] = useState<string>(line.rider);
  const [discountType, setDiscountType] = useState<"" | "fixed" | "percentage">(
    line.discount_type ?? "",
  );
  const [discountValue, setDiscountValue] = useState(line.discount_value);
  const [deliveryFee, setDeliveryFee] = useState(line.delivery_fee);
  const boundAction = editOrder.bind(null, line.id);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await boundAction(prev, formData);
      if (result.ok) {
        toast.success("Order updated");
        onDone();
      }
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const isOwnRider = rider === "Own Rider";
  const totals = computeOrderTotals({
    unitPrice: line.unit_price,
    quantity,
    vatRate: chargesVat ? line.vat_rate : 0,
    discountType: discountType || undefined,
    discountValue,
    deliveryFee: isOwnRider ? deliveryFee : 0,
  });

  return (
    <form action={formAction} className="flex flex-col gap-2.5 rounded-lg border border-teal/30 bg-teal/5 p-3">
      <div>
        <label className={labelClass}>Customer name *</label>
        <input name="customerName" required defaultValue={line.customer_name} className={fieldClass} />
        {errors?.customerName ? (
          <p className="mt-1 text-[10px] text-destructive">{errors.customerName[0]}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Phone</label>
          <input name="customerPhone" defaultValue={line.customer_phone ?? ""} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input name="customerEmail" type="email" defaultValue={line.customer_email ?? ""} className={fieldClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Address</label>
        <input name="deliveryAddress" defaultValue={line.delivery_address ?? ""} className={fieldClass} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Quantity</label>
          <input
            name="quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Rider</label>
          <select
            name="rider"
            value={rider}
            onChange={(e) => setRider(e.target.value)}
            className={cn(fieldClass, "appearance-none")}
          >
            <option>BNP Fleet</option>
            <option>Own Rider</option>
            <option>Pickup</option>
          </select>
        </div>
      </div>

      {isOwnRider ? (
        <div>
          <label className={labelClass}>Delivery price (₦)</label>
          <input
            name="deliveryFee"
            type="number"
            min="0"
            step="0.01"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value) || 0))}
            className={fieldClass}
          />
        </div>
      ) : null}

      <div>
        <label className={labelClass}>Status</label>
        <select name="status" defaultValue={line.status} className={cn(fieldClass, "appearance-none")}>
          {ORDER_STATUSES.map((s: OrderStatus) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Discount</label>
          <select
            name="discountType"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as typeof discountType)}
            className={cn(fieldClass, "appearance-none")}
          >
            <option value="">No discount</option>
            <option value="fixed">Fixed (₦)</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Value</label>
          <input
            name="discountValue"
            type="number"
            min="0"
            step="0.01"
            value={discountValue}
            onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
            disabled={!discountType}
            className={cn(fieldClass, !discountType && "opacity-50")}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea name="notes" rows={2} defaultValue={line.notes ?? ""} className={cn(fieldClass, "h-auto py-1.5")} />
      </div>

      <div className="rounded-md border border-stone bg-white p-2.5 text-xs">
        <div className="flex justify-between text-graphite">
          <span>Subtotal</span>
          <span>{naira(totals.subtotal)}</span>
        </div>
        {totals.discountAmount > 0 ? (
          <div className="flex justify-between text-graphite">
            <span>Discount</span>
            <span>-{naira(totals.discountAmount)}</span>
          </div>
        ) : null}
        {totals.vatAmount > 0 ? (
          <div className="flex justify-between text-graphite">
            <span>VAT</span>
            <span>{naira(totals.vatAmount)}</span>
          </div>
        ) : null}
        {totals.deliveryFee > 0 ? (
          <div className="flex justify-between text-graphite">
            <span>Delivery</span>
            <span>{naira(totals.deliveryFee)}</span>
          </div>
        ) : null}
        <div className="mt-1 flex justify-between border-t border-stone pt-1 font-semibold text-navy">
          <span>Total</span>
          <span>{naira(totals.total)}</span>
        </div>
      </div>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-[10px] text-destructive">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
