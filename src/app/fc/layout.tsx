import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatusGate } from "@/components/dashboard/status-gate";
import { AdminLink } from "@/components/dashboard/admin-link";

export default async function FulfillmentCenterLayout({
  children,
}: LayoutProps<"/">) {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth) redirect("/login?next=/fc");

  const { fc } = auth;

  if (!fc) {
    // Trigger hasn't caught up yet, or row was removed. Treat as pending.
    return <StatusGate title="Setting up your account" pending />;
  }

  if (fc.role !== "fulfillment_center") redirect("/dashboard");

  if (fc.status === "pending") {
    return <StatusGate title="Application under review" pending />;
  }

  if (fc.status === "suspended") {
    return <StatusGate title="Account suspended" suspended />;
  }

  return (
    <DashboardShell
      businessName={fc.business_name}
      navVariant="fc"
      sidebarFooter={fc.is_admin ? <AdminLink /> : undefined}
    >
      {children}
    </DashboardShell>
  );
}
