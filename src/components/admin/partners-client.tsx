"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Users, Boxes } from "lucide-react";
import type { Partner, PartnerStatus, PartnerStatusLog, StockEvent } from "@/types/db";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Panel } from "@/components/dashboard/ui";
import { setPartnerStatus } from "@/app/admin/partners/actions";

type StatusFilter = "All" | PartnerStatus;

const STATUS_COLOR: Record<PartnerStatus, string> = {
  pending: "bg-gold text-navy",
  active: "bg-success text-white",
  suspended: "bg-destructive text-white",
};

const ROLE_LABEL: Record<Partner["role"], string> = {
  merchant: "Merchant",
  fulfillment_center: "Fulfillment center",
};

export function AdminPartnersClient({
  partners,
  statusLogByPartner,
  stockEvents,
}: {
  partners: Partner[];
  statusLogByPartner: Record<string, PartnerStatusLog>;
  stockEvents: StockEvent[];
}) {
  const [filter, setFilter] = useState<StatusFilter>("All");

  const counts: Record<StatusFilter, number> = {
    All: partners.length,
    pending: partners.filter((p) => p.status === "pending").length,
    active: partners.filter((p) => p.status === "active").length,
    suspended: partners.filter((p) => p.status === "suspended").length,
  };

  const visible = useMemo(
    () => partners.filter((p) => filter === "All" || p.status === filter),
    [partners, filter],
  );

  const businessNameById = useMemo(
    () => new Map(partners.map((p) => [p.id, p.business_name])),
    [partners],
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {(["All", "pending", "active", "suspended"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors",
              filter === s
                ? "border-navy bg-navy text-white"
                : "border-stone bg-card text-graphite hover:border-teal/40",
            )}
          >
            {s} {counts[s]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="No partners here"
          body="Nobody matches this filter yet."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite">
              <tr>
                <th className="px-4 py-2.5">Business</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone">
              {visible.map((partner) => (
                <PartnerRow
                  key={partner.id}
                  partner={partner}
                  latestStatusLog={statusLogByPartner[partner.id]}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-navy">Recent restocks</h2>
        {stockEvents.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-8" />}
            title="No restocks yet"
            body="When a merchant increases a product's stock, it'll show up here."
          />
        ) : (
          <Panel>
            <div className="flex flex-col divide-y divide-stone">
              {stockEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium text-navy">
                      {businessNameById.get(event.partner_id) ?? "Unknown partner"}
                    </div>
                    <div className="text-xs text-mist">
                      {event.product_name} · {formatDate(event.created_at)}
                    </div>
                  </div>
                  <span className="font-semibold text-success">
                    +{event.quantity_added}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function PartnerRow({
  partner,
  latestStatusLog,
}: {
  partner: Partner;
  latestStatusLog?: PartnerStatusLog;
}) {
  const [status, setStatus] = useState(partner.status);
  const [reasonNote, setReasonNote] = useState(
    partner.status === "suspended" ? (latestStatusLog?.reason ?? null) : null,
  );
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [reasonInput, setReasonInput] = useState("");
  const [pending, startTransition] = useTransition();

  function apply(next: PartnerStatus, reason?: string) {
    startTransition(async () => {
      const result = await setPartnerStatus(partner.id, next, reason);
      if (result.ok) {
        setStatus(next);
        setReasonNote(next === "suspended" ? reason || null : null);
        toast.success(`${partner.business_name} is now ${next}`);
        setConfirmSuspend(false);
        setReasonInput("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <tr className="bg-card">
      <td className="px-4 py-3">
        <div className="font-medium text-navy">{partner.business_name}</div>
        <div className="text-xs text-mist">{partner.email}</div>
      </td>
      <td className="px-4 py-3 text-graphite">
        {ROLE_LABEL[partner.role]}
        {partner.is_admin ? (
          <span className="ml-2 inline-flex items-center rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Admin
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
            STATUS_COLOR[status],
          )}
        >
          {status}
        </span>
        {status === "suspended" && reasonNote ? (
          <div className="mt-1 max-w-[220px] text-[11px] text-mist italic">
            &ldquo;{reasonNote}&rdquo;
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-graphite">{formatDate(partner.created_at)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          {status === "pending" ? (
            <Button size="sm" disabled={pending} onClick={() => apply("active")}>
              Approve
            </Button>
          ) : null}
          {status === "active" ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => setConfirmSuspend(true)}
            >
              Suspend
            </Button>
          ) : null}
          {status === "suspended" ? (
            <Button size="sm" disabled={pending} onClick={() => apply("active")}>
              Reactivate
            </Button>
          ) : null}
        </div>
      </td>

      <Dialog open={confirmSuspend} onOpenChange={setConfirmSuspend}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Suspend {partner.business_name}?</DialogTitle>
          </DialogHeader>
          <p className="mb-2 text-sm text-graphite">
            This blocks their dashboard access. Say why, so there&apos;s a record of it.
          </p>
          <textarea
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            rows={3}
            required
            placeholder="Reason for suspension"
            className="w-full rounded-md border border-stone bg-white p-2.5 text-sm text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmSuspend(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending || !reasonInput.trim()}
              onClick={() => apply("suspended", reasonInput.trim())}
            >
              Suspend
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </tr>
  );
}
