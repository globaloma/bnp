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

  // Storefront payment refs are "<partner id prefix>-<order ref>".
  const orderRef = reference?.split("-").slice(1).join("-") || undefined;

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
          {orderRef ? (
            <p className="mt-4 rounded-lg bg-white px-4 py-2 text-sm text-graphite">
              Your order number is{" "}
              <span className="font-semibold text-navy">{orderRef}</span>
            </p>
          ) : null}
        </>
      ) : (
        <>
          <XCircle className="size-12 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold text-navy">Payment not confirmed</h1>
          <p className="mt-2 text-sm text-graphite">{result.error}</p>
        </>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {result.ok ? (
          <Button
            render={
              <Link
                href={`/store/${slug}/track${orderRef ? `?ref=${encodeURIComponent(orderRef)}` : ""}`}
              />
            }
            variant="outline"
          >
            Track your order
          </Button>
        ) : null}
        <Button render={<Link href={`/store/${slug}`} />}>Back to store</Button>
      </div>
    </div>
  );
}
