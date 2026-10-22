import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { confirmInvoicePayment } from "@/lib/invoice-payment";
import { Button } from "@/components/ui/button";

// Paystack sends merchants back here after paying an invoice.
export default async function InvoiceConfirmPage({ searchParams }: PageProps<"/dashboard/billing/confirm">) {
  const search = await searchParams;
  const reference = typeof search.reference === "string" ? search.reference : undefined;
  const result = reference
    ? await confirmInvoicePayment(reference)
    : { ok: false as const, error: "No payment reference was provided." };

  return (
    <div className="flex flex-col items-center py-16 text-center">
      {result.ok ? (
        <>
          <CheckCircle2 className="size-12 text-success" />
          <h1 className="mt-4 text-xl font-semibold text-navy">Invoice {result.number} paid</h1>
          <p className="mt-2 text-sm text-graphite">Thank you. If your account was paused, it&apos;s active again.</p>
        </>
      ) : (
        <>
          <XCircle className="size-12 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold text-navy">Payment not confirmed</h1>
          <p className="mt-2 text-sm text-graphite">{result.error}</p>
        </>
      )}
      <Button render={<Link href="/dashboard/billing" />} className="mt-6">
        Back to billing
      </Button>
    </div>
  );
}
