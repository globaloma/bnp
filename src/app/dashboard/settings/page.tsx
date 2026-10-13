import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedPartner } from "@/lib/data/partner";
import { PageHeader } from "@/components/dashboard/ui";
import { PasswordForm, ProfileForm } from "@/components/dashboard/settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Update your business details, logo and password."
      />
      <div className="flex max-w-3xl flex-col gap-6">
        <ProfileForm partner={auth.partner} isFc={false} />
        <PasswordForm />
      </div>
    </>
  );
}
