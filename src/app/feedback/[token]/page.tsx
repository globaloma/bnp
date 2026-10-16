import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { company } from "@/lib/site-content";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = {
  title: "Confirm your delivery",
  robots: { index: false, follow: false },
};

export default async function FeedbackPage({ params }: PageProps<"/feedback/[token]">) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: feedback } = await admin
    .from("order_feedback")
    .select("partner_id, order_ref, customer_name, responded_at, received_ok")
    .eq("token", token)
    .maybeSingle();

  if (!feedback) notFound();

  const { data: partner } = await admin
    .from("partners")
    .select("business_name")
    .eq("id", feedback.partner_id)
    .maybeSingle();
  const businessName = partner?.business_name ?? "your seller";
  const firstName = feedback.customer_name.split(/\s+/)[0] || feedback.customer_name;

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="border-b border-stone bg-white">
        <div className="container-page flex h-16 items-center">
          <span className="text-sm font-semibold text-navy">{businessName}</span>
        </div>
      </header>

      <main className="container-page flex w-full max-w-md flex-1 flex-col py-10">
        {feedback.responded_at ? (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="size-12 text-success" />
            <h1 className="mt-4 text-xl font-semibold text-navy">Thanks, {firstName}</h1>
            <p className="mt-2 text-sm text-graphite">
              {feedback.received_ok
                ? "We've already got your confirmation for this order."
                : "We've got your report and our team is following up."}
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-navy">Hi {firstName},</h1>
            <p className="mt-2 text-sm text-graphite">
              Your order <span className="font-semibold text-navy">{feedback.order_ref}</span> from{" "}
              {businessName} was marked as delivered. Did everything arrive well?
            </p>
            <FeedbackForm token={token} />
          </>
        )}
      </main>

      <footer className="border-t border-stone py-6 text-center text-xs text-mist">
        Delivered by{" "}
        <Link href="/" className="font-semibold text-teal-700 hover:underline">
          {company.name}
        </Link>
      </footer>
    </div>
  );
}
