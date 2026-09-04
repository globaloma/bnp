import { redirect } from "next/navigation";
import { Ban, Clock3 } from "lucide-react";
import { getAuthedPartner } from "@/lib/data/partner";
import { alertCount as computeAlertCount } from "@/lib/dashboard-metrics";
import { walletAvailable } from "@/lib/dashboard-metrics";
import { DashboardShell } from "@/components/dashboard/shell";
import { Logo } from "@/components/marketing/logo";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const auth = await getAuthedPartner();
  if (!auth) redirect("/login?next=/dashboard");

  const { partner } = auth;

  if (!partner) {
    // Trigger hasn't caught up yet, or row was removed. Treat as pending.
    return <StatusGate title="Setting up your account" pending />;
  }

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
    >
      {children}
    </DashboardShell>
  );
}

function StatusGate({
  title,
  pending,
  suspended,
}: {
  title: string;
  pending?: boolean;
  suspended?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-navy px-4 text-center">
      <Logo />
      <div className="max-w-sm rounded-2xl bg-white p-8">
        <span
          className={
            suspended
              ? "mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
              : "mx-auto flex size-12 items-center justify-center rounded-full bg-gold/15 text-gold"
          }
        >
          {suspended ? <Ban className="size-6" /> : <Clock3 className="size-6" />}
        </span>
        <h1 className="mt-4 text-lg font-semibold text-navy">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          {suspended
            ? "Your account has been suspended. Contact us if you believe this is a mistake."
            : pending
              ? "Our team reviews every new partner before granting dashboard access. This usually takes under 48 hours, we will email you as soon as you are approved."
              : "One moment."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button render={<a href="mailto:bnpfulfillment@gmail.com" />}>
            Email BNP Fulfillment
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
