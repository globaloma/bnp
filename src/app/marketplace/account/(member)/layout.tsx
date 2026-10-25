import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/marketplace/customer";
import { getShopBase } from "@/lib/marketplace/shop";
import { AccountNav } from "@/components/marketplace/account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [customer, base] = await Promise.all([getCustomer(), getShopBase()]);
  if (!customer) redirect(`${base}/account/login`);
  return (
    <div className="container-page grid gap-4 py-5 md:grid-cols-[14rem_1fr]">
      <AccountNav name={customer.full_name} email={customer.email} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
