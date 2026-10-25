import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AddressBook } from "@/components/marketplace/address-book";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_addresses")
    .select("id, label, full_name, phone, address, is_default")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return (
    <div className="rounded-lg bg-white">
      <h1 className="border-b border-stone px-4 py-3 text-lg font-semibold text-navy">Addresses</h1>
      <AddressBook addresses={data ?? []} />
    </div>
  );
}
