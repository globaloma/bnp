import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up",
};

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const params = await searchParams;
  const role = params.role === "fulfillment_center" ? "fulfillment_center" : "merchant";
  // "Get started" buttons on the pricing page pass the plan they came from.
  const plan = params.plan === "enterprise" ? "enterprise" : "standard";

  return <SignupForm initialRole={role} initialPlan={plan} />;
}
