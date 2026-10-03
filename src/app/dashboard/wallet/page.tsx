import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import { isFulfillmentRestricted, isWalletLow, walletAvailable } from "@/lib/dashboard-metrics";
import { naira, formatDate } from "@/lib/format";
import { PageHeader, Panel, EmptyState } from "@/components/dashboard/ui";
import { Receipt } from "lucide-react";
import { TopUpForm } from "./top-up-form";
import { BankAccountForm } from "./bank-account-form";
import { WithdrawForm } from "./withdraw-form";
import { listBanks } from "@/lib/paystack";

export const metadata: Metadata = { title: "Wallet" };

export default async function WalletPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");
  const { partner } = auth;

  const { walletTransactions } = await getDashboardData(partner.id);
  const restricted = isFulfillmentRestricted(partner);
  const low = isWalletLow(partner);
  const available = walletAvailable(partner);
  const hasBankAccount = Boolean(partner.paystack_recipient_code);

  let banks: { name: string; code: string }[] = [];
  let banksError: string | undefined;
  if (!hasBankAccount) {
    try {
      banks = await listBanks();
    } catch (err) {
      banksError =
        err instanceof Error ? err.message : "Could not load the list of banks right now.";
    }
  }

  return (
    <div>
      <PageHeader title="Wallet" description="Balance, top ups and deductions." />

      <div className="mb-5 rounded-lg bg-navy p-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mist">
          Total balance
        </div>
        <div
          className={`mt-1 text-4xl font-semibold ${low ? "text-destructive" : "text-white"}`}
        >
          {naira(partner.wallet_balance)}
        </div>
        {restricted ? (
          <p className="mt-3 text-xs font-semibold text-destructive">
            Fulfillment access suspended until you top up.
          </p>
        ) : null}
      </div>

      <Panel className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Top up wallet</h2>
        <TopUpForm />
      </Panel>

      <Panel className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Withdraw</h2>
        {hasBankAccount && partner.bank_account_name && partner.bank_account_number ? (
          <WithdrawForm
            available={available}
            bankAccountName={partner.bank_account_name}
            bankAccountNumber={partner.bank_account_number}
          />
        ) : (
          <BankAccountForm banks={banks} banksError={banksError} />
        )}
      </Panel>

      <Panel>
        <h2 className="mb-3 text-sm font-semibold text-navy">Transaction history</h2>
        {walletTransactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-8" />}
            title="No transactions yet"
            body="Top ups, subscription fees and fulfillment charges will appear here."
          />
        ) : (
          <div className="flex flex-col">
            {walletTransactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border-b border-stone py-2.5 text-sm last:border-b-0"
              >
                <div>
                  <div className="font-medium text-navy">{t.note || t.type}</div>
                  <div className="text-[11px] text-mist">
                    {formatDate(t.created_at)} · {t.type}
                  </div>
                </div>
                <div
                  className={`font-semibold ${t.amount > 0 ? "text-success" : "text-destructive"}`}
                >
                  {t.amount > 0 ? "+" : ""}
                  {naira(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
