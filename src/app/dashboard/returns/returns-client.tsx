"use client";

import { useActionState, useState } from "react";
import { Plus, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import type { Order, ReturnClaim } from "@/types/db";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, ReturnStatusBadge, Panel } from "@/components/dashboard/ui";
import { ImageUploadField } from "@/components/dashboard/image-upload";
import { fileReturn } from "./actions";
import type { ActionResult } from "@/lib/schemas/return";

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function ReturnsClient({
  returns,
  orders,
}: {
  returns: ReturnClaim[];
  orders: Order[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="lg" />}>
            <Plus className="size-4" />
            Report return or damage
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Report return or damage</DialogTitle>
            </DialogHeader>
            <ReportForm orders={orders} onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {returns.length === 0 ? (
        <EmptyState
          icon={<ThumbsUp className="size-8" />}
          title="No returns or claims filed"
          body="That's a good sign. Anything reported will show up here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {returns.map((r) => (
            <Panel
              key={r.id}
              accent={
                r.status === "Under Review"
                  ? "gold"
                  : r.status === "Approved"
                    ? "success"
                    : r.status === "Rejected"
                      ? "destructive"
                      : "none"
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs font-semibold text-teal">
                    {r.return_ref} · {r.order_ref}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-navy">
                    {r.product_name || "Item"}
                  </div>
                  <p className="mt-1 max-w-md text-xs text-graphite">{r.reason}</p>
                  <div className="mt-1 text-[11px] text-mist">
                    Filed {formatDate(r.filed_at)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ReturnStatusBadge status={r.status} />
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.image_url}
                      alt="Claim evidence"
                      className={cn("size-14 rounded-md border border-stone object-cover")}
                    />
                  ) : null}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportForm({
  orders,
  onDone,
}: {
  orders: Order[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await fileReturn(prev, formData);
      if (result.ok) {
        toast.success("Claim submitted");
        onDone();
      }
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (orders.length === 0) {
    return <p className="text-sm text-graphite">You have no orders to file a claim against yet.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div>
        <label className={labelClass}>Order reference *</label>
        <select name="orderId" required className={cn(fieldClass, "appearance-none")}>
          <option value="">Select an order</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.order_ref}, {o.product_name}
            </option>
          ))}
        </select>
        {errors?.orderId ? (
          <p className="mt-1 text-xs text-destructive">{errors.orderId[0]}</p>
        ) : null}
      </div>

      <div>
        <label className={labelClass}>Reason / description *</label>
        <textarea
          name="reason"
          required
          rows={3}
          className={cn(fieldClass, "h-auto resize-y py-2")}
          placeholder="Describe the issue in detail"
        />
        {errors?.reason ? (
          <p className="mt-1 text-xs text-destructive">{errors.reason[0]}</p>
        ) : null}
      </div>

      <div>
        <label className={labelClass}>Photo evidence</label>
        <ImageUploadField bucket="claim-images" name="imageUrl" />
      </div>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Submitting" : "Submit claim"}
      </Button>
    </form>
  );
}
