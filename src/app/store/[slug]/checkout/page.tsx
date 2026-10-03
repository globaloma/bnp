import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/public";
import { CheckoutForm } from "@/components/store/checkout-form";
import type { DeliveryZone, StorefrontPartner } from "@/types/db";

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

  const { data: zones } = await supabase
    .from("storefront_delivery_zones")
    .select("id, partner_id, name, fee")
    .eq("partner_id", partner.id)
    .order("name")
    .returns<DeliveryZone[]>();

  return (
    <div className="container-page max-w-lg py-8">
      <h1 className="mb-5 text-xl font-semibold text-navy">Checkout</h1>
      <CheckoutForm slug={slug} zones={zones ?? []} />
    </div>
  );
}
