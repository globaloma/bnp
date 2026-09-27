import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { confirmWalletTopup } from "@/lib/paystack";
import { Button } from "@/components/ui/button";

export default async function WalletConfirmPage({
  searchParams,
}: PageProps<"/dashboard/wallet/confirm">) {
  const search = await searchParams;
  const reference = typeof search.reference === "string" ? search.reference : undefined;

  const result = reference
    ? await confirmWalletTopup(reference)
    : { ok: false as const, error: "No payment reference was provided." };

  return (
    <div className="flex flex-col items-center py-16 text-center">
      {result.ok ? (
        <>
          <CheckCircle2 className="size-12 text-success" />
          <h1 className="mt-4 text-xl font-semibold text-navy">Top-up confirmed</h1>
          <p className="mt-2 text-sm text-graphite">
            Your wallet has been credited. It may take a moment to reflect below.
          </p>
        </>
      ) : (
        <>
          <XCircle className="size-12 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold text-navy">Top-up not confirmed</h1>
          <p className="mt-2 text-sm text-graphite">{result.error}</p>
        </>
      )}
      <Button render={<Link href="/dashboard/wallet" />} className="mt-6">
        Back to wallet
      </Button>
    </div>
  );
}
