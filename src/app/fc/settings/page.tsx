import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { PageHeader } from "@/components/dashboard/ui";
import { PasswordForm, ProfileForm } from "@/components/dashboard/settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function FcSettingsPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Update your fulfillment center details, logo and password."
      />
      <div className="flex max-w-3xl flex-col gap-6">
        <ProfileForm partner={auth.fc} isFc />
        <PasswordForm />
      </div>
    </>
  );
}
