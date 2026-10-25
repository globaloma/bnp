import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { confirmMarketplacePayment, marketplaceOrders } from "@/lib/marketplace/payment";
import { getShopBase, getShopOrigin } from "@/lib/marketplace/shop";
import { naira } from "@/lib/format";
import { ClearCart } from "@/components/store/clear-cart";

export const metadata: Metadata = { title: "Order confirmation" };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const reference = typeof search.reference === "string" && search.reference.startsWith("MKT-") ? search.reference : null;
  const [base, origin] = await Promise.all([getShopBase(), getShopOrigin()]);
  const result = reference
    ? await confirmMarketplacePayment(reference, origin)
    : ({ ok: false, error: "No payment reference was provided." } as const);
  const orders = result.ok && reference ? await marketplaceOrders(reference) : [];
  const total = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="container-page flex max-w-xl flex-col items-center py-12 text-center">
      {result.ok ? (
        <>
          <ClearCart />
          <CheckCircle2 className="size-14 text-success" />
          <h1 className="mt-4 text-2xl font-semibold text-navy">Thank you, your order is confirmed</h1>
          <p className="mt-2 text-sm text-graphite">
            We&apos;ve received your payment and our warehouse is getting your items ready.
            {orders.length > 1 ? ` They'll come as ${orders.length} parcels, one per seller.` : ""}
          </p>
          <div className="mt-6 w-full rounded-lg bg-white p-4 text-left">
            {orders.map((o) => (
              <div key={o.orderRef} className="border-b border-stone py-3 last:border-0">
                <p className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-semibold text-navy">Order {o.orderRef}</span>
                  <span className="text-xs text-mist">from {o.seller}</span>
                </p>
                <ul className="mt-1 text-xs text-graphite">
                  {o.items.map((i, n) => (
                    <li key={n} className="flex justify-between">
                      <span>
                        {i.name} {i.quantity > 1 ? `x ${i.quantity}` : ""}
                      </span>
                      <span>{naira(i.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {orders.length > 0 ? (
              <p className="flex justify-between pt-3 text-sm font-bold text-navy">
                <span>Total paid</span>
                <span>{naira(total)}</span>
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-mist">Keep your order number. You can track it with the phone number you gave at checkout.</p>
        </>
      ) : (
        <>
          <XCircle className="size-14 text-destructive" />
          <h1 className="mt-4 text-2xl font-semibold text-navy">Payment not confirmed</h1>
          <p className="mt-2 text-sm text-graphite">{result.error}</p>
          <p className="mt-1 text-xs text-mist">Your cart is still saved, so you can try again.</p>
        </>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {result.ok && orders[0] ? (
          <Link
            href={`${base}/track?ref=${encodeURIComponent(orders[0].orderRef)}`}
            className="rounded-md border border-navy px-5 py-2.5 text-sm font-semibold text-navy hover:bg-navy/5"
          >
            Track your order
          </Link>
        ) : (
          <Link href={`${base}/checkout`} className="rounded-md border border-navy px-5 py-2.5 text-sm font-semibold text-navy hover:bg-navy/5">
            Back to checkout
          </Link>
        )}
        <Link href={base || "/"} className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-navy hover:bg-gold-300">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
