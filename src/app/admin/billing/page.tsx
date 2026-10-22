import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import type { Invoice } from "@/types/db";
import {
  AdjustWallet,
  DeclaredRequests,
  EnterpriseTable,
  InvoicesTable,
  RunBilling,
  type DeclaredRequestRow,
  type MerchantRow,
} from "./billing-admin-client";

export const metadata: Metadata = { title: "Billing" };

export default async function AdminBillingPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: merchants }, { data: invoices }, { data: requests }] = await Promise.all([
    supabase.from("billing_settings").select("*").single(),
    supabase
      .from("partners")
      .select(
        "id, business_name, plan_type, storage_sqm, wallet_balance, wallet_buffer, account_manager, billing_locked, orders_paused, status",
      )
      .eq("role", "merchant")
      .order("business_name"),
    supabase.from("invoices").select("*").order("issued_at", { ascending: false }).limit(100),
    supabase
      .from("declared_value_requests")
      .select("*, product:products(name, variant, sku, on_hand), partner:partners(business_name)")
      .order("requested_at", { ascending: false })
      .limit(50),
  ]);

  const rows: MerchantRow[] = (merchants ?? []).map((m) => ({
    id: m.id,
    name: m.business_name,
    plan: m.plan_type,
    sqm: Number(m.storage_sqm),
    balance: Number(m.wallet_balance),
    minimum: Number(m.wallet_buffer),
    manager: m.account_manager,
    locked: m.billing_locked,
    paused: m.orders_paused,
    active: m.status === "active",
  }));
  const names = new Map(rows.map((r) => [r.id, r.name]));

  type Req = {
    id: string;
    old_value: number | null;
    requested_value: number;
    reason: string;
    status: string;
    requested_at: string;
    admin_notes: string | null;
    product: { name: string; variant: string | null; sku: string | null; on_hand: number } | null;
    partner: { business_name: string } | null;
  };
  const requestRows: DeclaredRequestRow[] = ((requests ?? []) as unknown as Req[]).map((r) => ({
    id: r.id,
    merchant: r.partner?.business_name ?? "Merchant",
    product: r.product ? (r.product.variant ? `${r.product.name} (${r.product.variant})` : r.product.name) : "Product",
    onHand: r.product?.on_hand ?? 0,
    oldValue: r.old_value === null ? null : Number(r.old_value),
    newValue: Number(r.requested_value),
    reason: r.reason,
    status: r.status,
    notes: r.admin_notes,
  }));

  return (
    <>
      <PageHeader
        title="Billing"
        description="Standard merchants get an invoice on the 1st; Enterprise merchants are charged from their wallet. The daily job runs this automatically. Use these controls to set terms, fix things and run a month by hand."
      />
      <div className="flex flex-col gap-8">
        <RunBilling startMonth={settings?.start_month ?? "2026-11-01"} />
        <EnterpriseTable rows={rows} rates={{ storage: Number(settings?.storage_rate ?? 10000), enterprise: Number(settings?.enterprise_rate ?? 0.09) }} />
        <InvoicesTable invoices={(invoices ?? []) as Invoice[]} names={Object.fromEntries(names)} />
        <DeclaredRequests rows={requestRows} />
        <AdjustWallet merchants={rows.map((r) => ({ id: r.id, name: r.name, balance: r.balance }))} />
      </div>
    </>
  );
}
