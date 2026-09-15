import { redirect } from "next/navigation";
import { getAuthedPartner } from "@/lib/data/partner";
import { alertCount as computeAlertCount } from "@/lib/dashboard-metrics";
import { walletAvailable } from "@/lib/dashboard-metrics";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatusGate } from "@/components/dashboard/status-gate";
import { WarehouseFooter } from "@/components/dashboard/warehouse-footer";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const auth = await getAuthedPartner();
  if (!auth) redirect("/login?next=/dashboard");

  const { partner } = auth;

  if (!partner) {
    // Trigger hasn't caught up yet, or row was removed. Treat as pending.
    return <StatusGate title="Setting up your account" pending />;
  }

  if (partner.role === "fulfillment_center") redirect("/fc");

  if (partner.status === "pending") {
    return <StatusGate title="Application under review" pending />;
  }

  if (partner.status === "suspended") {
    return <StatusGate title="Account suspended" suspended />;
  }

  let products: { id: string; stock: number; last_moved_at: string }[] = [];
  {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("id, stock, last_moved_at")
      .eq("partner_id", partner.id);
    products = data ?? [];
  }

  const alerts = computeAlertCount(products, partner);

  return (
    <DashboardShell
      businessName={partner.business_name}
      walletAvailable={walletAvailable(partner)}
      alertCount={alerts}
      alertHref="/dashboard/alerts"
      sidebarFooter={<WarehouseFooter />}
    >
      {children}
    </DashboardShell>
  );
}
