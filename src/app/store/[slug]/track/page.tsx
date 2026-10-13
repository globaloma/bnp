import type { Metadata } from "next";
import { TrackOrderForm } from "@/components/store/track-order-form";

export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false },
};

export default async function TrackOrderPage({
  params,
  searchParams,
}: PageProps<"/store/[slug]/track">) {
  const { slug } = await params;
  const search = await searchParams;
  const ref = typeof search.ref === "string" ? search.ref.slice(0, 40) : "";

  return (
    <div className="container-page max-w-xl py-10">
      <h1 className="text-xl font-semibold text-navy">Track your order</h1>
      <p className="mt-1 text-sm text-graphite">
        Enter your order number and the phone number you used at checkout.
      </p>
      <TrackOrderForm slug={slug} initialRef={ref} />
    </div>
  );
}
