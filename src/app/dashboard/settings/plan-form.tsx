"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { pricing } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/dashboard/ui";
import { changePlan } from "./plan-actions";

export function PlanForm({ current }: { current: "standard" | "enterprise" }) {
  const [plan, setPlan] = useState(current);
  const [pending, startTransition] = useTransition();

  function switchTo(next: "standard" | "enterprise") {
    startTransition(async () => {
      const result = await changePlan(next);
      if (result.ok) {
        setPlan(next);
        toast.success(
          next === "enterprise"
            ? "You're on Enterprise. Our team will be in touch to set up your account manager and wallet."
            : "You're on Standard.",
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Panel accent="gold">
      <h2 className="text-base font-semibold text-navy">Your plan</h2>
      <p className="mt-1 text-sm text-graphite">
        Standard suits most growing brands. Enterprise adds insured stock and a dedicated account manager.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {pricing.plans.map((p) => {
          const active = plan === p.id;
          return (
            <div
              key={p.id}
              className={cn(
                "flex flex-col rounded-lg border-2 p-4",
                active ? "border-navy bg-navy/5" : "border-stone",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-navy">{p.name}</span>
                {active ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-success">
                    <CheckCircle2 className="size-4" />
                    Current plan
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-sm text-graphite">
                <span className="font-semibold text-navy">{p.fee}</span> {p.feeUnit}
              </div>
              <ul className="mt-2 flex flex-1 flex-col gap-1 text-xs text-graphite">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              {!active ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={pending}
                  onClick={() => switchTo(p.id)}
                >
                  {pending ? "Switching" : `Switch to ${p.name}`}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
