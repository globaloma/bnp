import type { Metadata } from "next";
import { getCustomer } from "@/lib/marketplace/customer";
import { ProfileForm } from "@/components/marketplace/profile-form";

export const metadata: Metadata = { title: "Account details" };

export default async function DetailsPage() {
  const customer = await getCustomer();
  return (
    <div className="rounded-lg bg-white">
      <h1 className="border-b border-stone px-4 py-3 text-lg font-semibold text-navy">Account details</h1>
      <div className="p-4">
        <ProfileForm name={customer?.full_name ?? ""} phone={customer?.phone ?? ""} email={customer?.email ?? ""} />
      </div>
    </div>
  );
}
