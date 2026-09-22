"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { Award } from "lucide-react";
import type { Partner, RewardEvent } from "@/types/db";
import { naira, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/ui";
import { issueReward } from "@/app/admin/rewards/actions";
import type { ActionResult } from "@/lib/schemas/admin";

const fieldClass =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function AdminRewardsClient({
  partners,
  rewards,
}: {
  partners: Partner[];
  rewards: RewardEvent[];
}) {
  const partnerName = (id: string) =>
    partners.find((p) => p.id === id)?.business_name ?? "Unknown partner";

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <IssueRewardForm partners={partners} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy">Recent rewards</h2>
        {rewards.length === 0 ? (
          <EmptyState
            icon={<Award className="size-8" />}
            title="No rewards issued yet"
            body="Rewards you issue will show up here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rewards.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-stone bg-card px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-navy">{partnerName(r.partner_id)}</div>
                  <div className="text-xs text-mist">
                    {r.type}
                    {r.reason ? ` · ${r.reason}` : ""} · {formatDate(r.created_at)}
                  </div>
                </div>
                {r.amount > 0 ? (
                  <div className="font-semibold text-success">{naira(r.amount)}</div>
                ) : (
                  <div className="text-xs font-medium text-graphite">Non-monetary</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function IssueRewardForm({ partners }: { partners: Partner[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await issueReward(prev, formData);
      if (result.ok) toast.success("Reward issued");
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form
      action={formAction}
      className="flex h-fit flex-col gap-3.5 rounded-lg border border-stone bg-card p-5"
    >
      <div>
        <label className={labelClass}>Partner *</label>
        <select name="partnerId" required className={cn(fieldClass, "appearance-none")}>
          <option value="">Select a partner</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.business_name}
            </option>
          ))}
        </select>
        {errors?.partnerId ? (
          <p className="mt-1 text-xs text-destructive">{errors.partnerId[0]}</p>
        ) : null}
      </div>

      <div>
        <label className={labelClass}>Amount (naira)</label>
        <input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-graphite">
          Leave at 0 for a non-monetary perk. Anything above 0 credits the partner&apos;s wallet.
        </p>
      </div>

      <div>
        <label className={labelClass}>Type</label>
        <input name="type" defaultValue="Reward" className={fieldClass} />
      </div>

      <div>
        <label className={labelClass}>Reason</label>
        <textarea
          name="reason"
          rows={3}
          className={cn(fieldClass, "h-auto py-2")}
          placeholder="e.g. Hit 30 orders in a month"
        />
      </div>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? "Issuing" : "Issue reward"}
      </Button>
    </form>
  );
}
