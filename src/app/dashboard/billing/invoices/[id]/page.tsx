import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAuthedPartner } from "@/lib/data/partner";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/types/db";
import { buildInvoiceStatement, currentPeriod } from "@/lib/invoice-statement";
import { InvoiceDocument } from "../../invoice-document";
import { InvoiceActionsBar } from "../../invoice-actions-bar";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: PageProps<"/dashboard/billing/invoices/[id]">) {
  const { id } = await params;
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");
  const { partner } = auth;
  const supabase = await createClient();

  // "current" renders the live running draft for the month in progress.
  let statement;
  if (id === "current") {
    statement = await buildInvoiceStatement(supabase, { partnerId: partner.id, period: currentPeriod() });
  } else {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("partner_id", partner.id)
      .maybeSingle();
    if (!invoice) notFound();
    statement = await buildInvoiceStatement(supabase, { partnerId: partner.id, invoice: invoice as Invoice });
  }
  if (!statement) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <InvoiceActionsBar />
      <InvoiceDocument statement={statement} />
    </div>
  );
}
