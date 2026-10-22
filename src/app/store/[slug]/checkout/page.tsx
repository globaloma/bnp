import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadDeliveryOptions } from "@/lib/delivery-pricing";
import type { DeliveryOptions } from "@/lib/delivery-methods";
import { CheckoutForm } from "@/components/store/checkout-form";
import type { StorefrontPartner, WarehouseLocation } from "@/types/db";

export default async function CheckoutPage({
  params,
}: PageProps<"/store/[slug]/checkout">) {
  const { slug } = await params;
  const supabase = createClient();

  const { data: partner } = await supabase
    .from("storefront_partners")
    .select("id")
    .eq("slug", slug)
    .maybeSingle<Pick<StorefrontPartner, "id">>();

  if (!partner) notFound();

  // Delivery prices and product weights are public information, read with
  // the server's client so the merchant's own delivery areas are included.
  const admin = createAdminClient();
  const { data: products } = await admin
    .from("products")
    .select("id, location, weight_kg")
    .eq("partner_id", partner.id)
    .eq("published", true);

  const hubs = [...new Set((products ?? []).map((p) => p.location as WarehouseLocation))];
  const options = Object.fromEntries(
    await Promise.all(hubs.map(async (hub) => [hub, await loadDeliveryOptions(admin, hub, partner.id)] as const)),
  ) as Partial<Record<WarehouseLocation, DeliveryOptions>>;
  const weights = Object.fromEntries((products ?? []).map((p) => [p.id, Number(p.weight_kg) || 0]));

  return (
    <div className="container-page max-w-lg py-8">
      <h1 className="mb-5 text-xl font-semibold text-navy">Checkout</h1>
      <CheckoutForm slug={slug} options={options} weights={weights} />
    </div>
  );
}
