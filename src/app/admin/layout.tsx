import { redirect } from "next/navigation";
import { getAuthedAdmin } from "@/lib/data/admin";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatusGate } from "@/components/dashboard/status-gate";
import { roleHome } from "@/lib/roles";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const auth = await getAuthedAdmin();
  if (!auth) redirect("/login?next=/admin");

  const { admin } = auth;

  if (!admin) {
    // Trigger hasn't caught up yet, or row was removed. Treat as pending.
    return <StatusGate title="Setting up your account" pending />;
  }

  if (admin.role !== "admin") redirect(roleHome(admin.role));

  if (admin.status === "pending") {
    return <StatusGate title="Application under review" pending />;
  }

  if (admin.status === "suspended") {
    return <StatusGate title="Account suspended" suspended />;
  }

  return (
    <DashboardShell businessName={admin.business_name} navVariant="admin">
      {children}
    </DashboardShell>
  );
}
