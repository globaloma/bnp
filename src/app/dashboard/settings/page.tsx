import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedPartner } from "@/lib/data/partner";
import { PageHeader } from "@/components/dashboard/ui";
import {
  PasswordForm,
  ProfileForm,
  StorefrontForm,
} from "@/components/dashboard/settings-forms";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Settings" };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export default async function SettingsPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your plan, business details, storefront and password."
      />
      <div className="flex max-w-3xl flex-col gap-6">
        <PlanForm current={auth.partner.plan_type ?? "standard"} />
        <ProfileForm partner={auth.partner} isFc={false} />
        <StorefrontForm
          partner={auth.partner}
          storefrontUrl={`${SITE_URL}/store/${auth.partner.slug}`}
        />
        <PasswordForm />
      </div>
    </>
  );
}
