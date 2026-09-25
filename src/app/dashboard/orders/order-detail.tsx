"use client";

import { useActionState, useState, useTransition } from "react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Download, MessageCircle, Mail, Pencil, Trash2 } from "lucide-react";
import type { Order, OrderStatus } from "@/types/db";
import { ORDER_STATUSES } from "@/types/db";
import { naira, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderStatusBadge } from "@/components/dashboard/ui";
import { buildReceiptText, normalizeNigerianPhone } from "@/lib/receipt";
import { computeOrderTotals } from "@/lib/orders";
import { editOrder, deleteOrderLine, deleteOrderGroup } from "./actions";
import type { ActionResult } from "@/lib/schemas/order";

const fieldClass =
  "h-9 w-full rounded-md border border-stone bg-white px-2.5 text-xs text-navy outline-none transition-colors focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function OrderDetail({
  orderRef,
  lines,
  onClose,
}: {
  orderRef: string;
  lines: Order[];
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteLine, setConfirmDeleteLine] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [pending, startTransition] = useTransition();

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

  function handleDownloadPdf() {
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(14);
    doc.text(`Receipt - ${orderRef}`, 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Date: ${formatDate(first.placed_at)}`, 14, y);
    y += 6;
    doc.text(`Customer: ${first.customer_name}`, 14, y);
    y += 6;
    if (first.customer_phone) {
      doc.text(`Phone: ${first.customer_phone}`, 14, y);
      y += 6;
    }
    if (first.delivery_address) {
      doc.text(`Address: ${first.delivery_address}`, 14, y);
      y += 6;
    }
    y += 4;
    doc.setFontSize(11);
    doc.text("Items", 14, y);
    y += 6;
    doc.setFontSize(10);
    for (const line of lines) {
      doc.text(`${line.product_name} x${line.quantity}`, 14, y);
      doc.text(naira(line.total), 180, y, { align: "right" });
      y += 6;
    }
    y += 4;
    doc.text("Subtotal", 14, y);
    doc.text(naira(subtotal), 180, y, { align: "right" });
    y += 6;
    if (discount > 0) {
      doc.text("Discount", 14, y);
      doc.text(`-${naira(discount)}`, 180, y, { align: "right" });
      y += 6;
    }
    if (vat > 0) {
      doc.text("VAT", 14, y);
      doc.text(naira(vat), 180, y, { align: "right" });
      y += 6;
    }
    if (delivery > 0) {
      doc.text("Delivery", 14, y);
      doc.text(naira(delivery), 180, y, { align: "right" });
      y += 6;
    }
    doc.setFontSize(12);
    doc.text("Total", 14, y);
    doc.text(naira(total), 180, y, { align: "right" });

    doc.save(`${orderRef}.pdf`);
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
        <Button type="button" variant="outline" size="sm" onClick={handleDownloadPdf}>
          <Download className="size-3.5" />
          PDF
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleShareWhatsApp}>
          <MessageCircle className="size-3.5" />
          WhatsApp
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleShareEmail}>
          <Mail className="size-3.5" />
          Email
        </Button>
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

function EditLineForm({ line, onDone }: { line: Order; onDone: () => void }) {
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
    vatRate: line.vat_rate,
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
