"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAILURE_REASONS, progressLabel, type DeliveryProgress } from "@/lib/delivery-progress";
import type { Order } from "@/types/db";

type Result = { ok: true } | { ok: false; error: string };

/** Small tag next to the status badge: "In transit" or "Delivery failed". */
export function DeliveryProgressTag({
  order,
}: {
  order: Pick<Order, "status" | "delivery_progress" | "delivery_failed_attempts">;
}) {
  const label = progressLabel(order);
  if (!label) return null;
  const failed = order.delivery_progress === "failed";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        failed ? "bg-destructive/10 text-destructive" : "bg-teal/10 text-teal-700",
      )}
    >
      {label}
    </span>
  );
}

/**
 * For a dispatched order: mark it on the way, or record a failed delivery
 * attempt with a reason. A failed order can be sent out again (On the way)
 * or marked Returned or Delivered with the normal status control.
 */
export function DeliveryProgressControl({
  order,
  onSet,
}: {
  order: Pick<
    Order,
    "status" | "delivery_progress" | "delivery_failed_attempts" | "delivery_failure_note" | "delivery_progress_at"
  >;
  onSet: (progress: DeliveryProgress, note?: string) => Promise<Result>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState<string>(FAILURE_REASONS[0]);
  const [other, setOther] = useState("");

  if (order.status !== "Dispatched") return null;

  function save(progress: DeliveryProgress, note?: string) {
    startTransition(async () => {
      const result = await onSet(progress, note);
      if (result.ok) {
        toast.success(progress === "failed" ? "Failed delivery recorded." : "Marked as on the way.");
        setFailing(false);
        setOther("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const button =
    "inline-flex h-7 items-center gap-1.5 rounded-md border border-stone bg-card px-2.5 text-[11px] font-semibold text-graphite transition-colors hover:border-teal/40 hover:text-teal-700 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mist">Delivery</span>
        <DeliveryProgressTag order={order} />
        {order.delivery_progress !== "in_transit" ? (
          <button type="button" className={button} disabled={pending} onClick={() => save("in_transit")}>
            <Truck className="size-3.5" />
            {order.delivery_progress === "failed" ? "Sent out again" : "On the way"}
          </button>
        ) : null}
        {!failing ? (
          <button type="button" className={button} disabled={pending} onClick={() => setFailing(true)}>
            <AlertTriangle className="size-3.5" />
            Delivery failed
          </button>
        ) : null}
      </div>
      {order.delivery_progress === "failed" && order.delivery_failure_note ? (
        <p className="text-[11px] text-destructive">
          Last attempt: {order.delivery_failure_note}
          {order.delivery_progress_at
            ? `, ${new Date(order.delivery_progress_at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
            : ""}
          . Send it out again, or mark it Returned once it&apos;s back.
        </p>
      ) : null}
      {failing ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-stone bg-cream/60 p-2">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 rounded-md border border-stone bg-white px-2 text-xs text-navy"
          >
            {FAILURE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="other">Something else</option>
          </select>
          {reason === "other" ? (
            <input
              value={other}
              onChange={(e) => setOther(e.target.value)}
              maxLength={200}
              placeholder="What happened?"
              className="h-8 min-w-48 flex-1 rounded-md border border-stone bg-white px-2 text-xs text-navy"
            />
          ) : null}
          <button
            type="button"
            disabled={pending || (reason === "other" && other.trim().length < 3)}
            onClick={() => save("failed", reason === "other" ? other.trim() : reason)}
            className="h-8 rounded-md bg-destructive px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            Record failed attempt
          </button>
          <button type="button" onClick={() => setFailing(false)} className="text-xs font-semibold text-graphite hover:underline">
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
