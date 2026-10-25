import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadDeliveryOptions } from "@/lib/delivery-pricing";
import { getCustomer } from "@/lib/marketplace/customer";
import { MarketCheckoutForm, type SavedAddress } from "@/components/marketplace/checkout-form";
import type { DeliveryOptions } from "@/lib/delivery-methods";

export const metadata: Metadata = { title: "Checkout" };

// Merchants' own delivery areas don't apply on the shop, so any id will do.
const NO_MERCHANT = "00000000-0000-0000-0000-000000000000";

export default async function CheckoutPage() {
  const admin = createAdminClient();
  const [customer, abuja, lagos] = await Promise.all([
    getCustomer(),
    loadDeliveryOptions(admin, "Abuja", NO_MERCHANT),
    loadDeliveryOptions(admin, "Lagos", NO_MERCHANT),
  ]);
  let addresses: SavedAddress[] = [];
  if (customer) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customer_addresses")
      .select("id, label, full_name, phone, address, is_default")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    addresses = (data ?? []) as SavedAddress[];
  }
  const options: Record<"Abuja" | "Lagos", DeliveryOptions> = { Abuja: abuja, Lagos: lagos };

  return (
    <div className="container-page py-5">
      <h1 className="mb-4 text-xl font-semibold text-navy">Checkout</h1>
      <MarketCheckoutForm
        options={options}
        customer={customer ? { name: customer.full_name, phone: customer.phone, email: customer.email } : null}
        addresses={addresses}
      />
    </div>
  );
}
