"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import type { Partner, PartnerStatus } from "@/types/db";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/ui";
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
  admin: "Admin",
};

export function AdminPartnersClient({ partners }: { partners: Partner[] }) {
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
                <PartnerRow key={partner.id} partner={partner} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PartnerRow({ partner }: { partner: Partner }) {
  const [status, setStatus] = useState(partner.status);
  const [pending, startTransition] = useTransition();

  function apply(next: PartnerStatus) {
    startTransition(async () => {
      const result = await setPartnerStatus(partner.id, next);
      if (result.ok) {
        setStatus(next);
        toast.success(`${partner.business_name} is now ${next}`);
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
      <td className="px-4 py-3 text-graphite">{ROLE_LABEL[partner.role]}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
            STATUS_COLOR[status],
          )}
        >
          {status}
        </span>
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
              onClick={() => apply("suspended")}
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
    </tr>
  );
}
