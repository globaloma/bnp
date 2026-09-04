import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { OrderStatus, ReturnStatus } from "@/types/db";

export function Panel({
  children,
  className,
  accent = "gold",
}: {
  children: ReactNode;
  className?: string;
  accent?: "gold" | "teal" | "success" | "destructive" | "none";
}) {
  const accentColor = {
    gold: "border-l-gold",
    teal: "border-l-teal",
    success: "border-l-success",
    destructive: "border-l-destructive",
    none: "border-l-transparent",
  }[accent];

  return (
    <div
      className={cn(
        "rounded-lg rounded-l-none border border-stone bg-card p-5 shadow-sm",
        "border-l-4",
        accentColor,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent = "gold",
  dark,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: "gold" | "teal" | "success" | "destructive";
  dark?: boolean;
}) {
  const accentColor = {
    gold: "border-l-gold",
    teal: "border-l-teal",
    success: "border-l-success",
    destructive: "border-l-destructive",
  }[accent];

  return (
    <div
      className={cn(
        "flex-1 min-w-[140px] rounded-lg rounded-l-none border-l-4 p-4",
        accentColor,
        dark ? "bg-navy" : "bg-card border border-stone border-l-4",
      )}
    >
      <div
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.1em]",
          dark ? "text-mist" : "text-mist",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          dark ? "text-white" : "text-navy",
        )}
      >
        {value}
      </div>
      {sub ? (
        <div className={cn("mt-0.5 text-xs", dark ? "text-mist" : "text-graphite")}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  Packaging: "bg-gold text-navy",
  Shipping: "bg-teal text-white",
  Delivered: "bg-navy text-white",
  Returned: "bg-destructive text-white",
  Damaged: "bg-destructive text-white",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        ORDER_STATUS_COLOR[status],
      )}
    >
      {status}
    </span>
  );
}

const RETURN_STATUS_COLOR: Record<ReturnStatus, string> = {
  "Under Review": "bg-gold text-navy",
  Approved: "bg-success text-white",
  Rejected: "bg-destructive text-white",
  Resolved: "bg-navy text-white",
};

export function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        RETURN_STATUS_COLOR[status],
      )}
    >
      {status}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone px-6 py-12 text-center">
      {icon ? <span className="text-mist">{icon}</span> : null}
      <p className="text-sm font-semibold text-navy">{title}</p>
      {body ? <p className="max-w-xs text-xs text-graphite">{body}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-graphite">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
