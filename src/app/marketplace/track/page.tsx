import type { Metadata } from "next";
import { TrackOrderForm } from "@/components/store/track-order-form";
import { SHOP_TRACK_SLUG } from "@/lib/order-tracking";

export const metadata: Metadata = { title: "Track your order" };

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ref } = await searchParams;
  return (
    <div className="container-page max-w-xl py-8">
      <h1 className="text-xl font-semibold text-navy">Track your order</h1>
      <p className="mt-1 mb-5 text-sm text-graphite">
        Enter the order number from your confirmation and the phone number you used at checkout. If your cart had items from
        more than one seller, each parcel has its own order number.
      </p>
      <TrackOrderForm slug={SHOP_TRACK_SLUG} initialRef={typeof ref === "string" ? ref.slice(0, 40) : ""} />
    </div>
  );
}
