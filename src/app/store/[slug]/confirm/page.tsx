import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { confirmPayment } from "@/lib/paystack";
import { Button } from "@/components/ui/button";

export default async function ConfirmPage({
  params,
  searchParams,
}: PageProps<"/store/[slug]/confirm">) {
  const { slug } = await params;
  const search = await searchParams;
  const reference = typeof search.reference === "string" ? search.reference : undefined;

  const result = reference
    ? await confirmPayment(reference)
    : { ok: false as const, error: "No payment reference was provided." };

  return (
    <div className="container-page flex max-w-md flex-col items-center py-16 text-center">
      {result.ok ? (
        <>
          <CheckCircle2 className="size-12 text-success" />
          <h1 className="mt-4 text-xl font-semibold text-navy">Payment confirmed</h1>
          <p className="mt-2 text-sm text-graphite">
            Thanks for your order. The seller has been notified and your order is now
            being prepared for delivery.
          </p>
        </>
      ) : (
        <>
          <XCircle className="size-12 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold text-navy">Payment not confirmed</h1>
          <p className="mt-2 text-sm text-graphite">{result.error}</p>
        </>
      )}
      <Button render={<Link href={`/store/${slug}`} />} className="mt-6">
        Back to store
      </Button>
    </div>
  );
}
