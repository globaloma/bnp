import { CheckoutForm } from "@/components/store/checkout-form";

export default async function CheckoutPage({
  params,
}: PageProps<"/store/[slug]/checkout">) {
  const { slug } = await params;

  return (
    <div className="container-page max-w-lg py-8">
      <h1 className="mb-5 text-xl font-semibold text-navy">Checkout</h1>
      <CheckoutForm slug={slug} />
    </div>
  );
}
