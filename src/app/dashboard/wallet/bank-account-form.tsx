"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveBankAccount, saveBankAccount } from "./actions";

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function BankAccountForm({
  banks,
  banksError,
}: {
  banks: { name: string; code: string }[];
  banksError?: string;
}) {
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleVerify() {
    setError(null);
    setResolvedName(null);
    startTransition(async () => {
      const result = await resolveBankAccount(bankCode, accountNumber);
      if (result.ok) {
        setResolvedName(result.accountName);
      } else {
        setError(result.error);
      }
    });
  }

  function handleSave() {
    if (!resolvedName) return;
    startTransition(async () => {
      const result = await saveBankAccount(bankCode, accountNumber, resolvedName);
      if (result.ok) {
        toast.success("Bank account saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  if (banksError) {
    return <p className="text-sm text-destructive">{banksError}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-graphite">
        Add the bank account withdrawals should go to.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Bank</label>
          <select
            value={bankCode}
            onChange={(e) => {
              setBankCode(e.target.value);
              setResolvedName(null);
            }}
            className={`${fieldClass} appearance-none`}
          >
            <option value="">Select a bank</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Account number</label>
          <input
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value.replace(/\D/g, ""));
              setResolvedName(null);
            }}
            maxLength={10}
            placeholder="0123456789"
            className={fieldClass}
          />
        </div>
      </div>

      {resolvedName ? (
        <div className="rounded-md bg-success/10 px-3 py-2 text-sm font-semibold text-success">
          {resolvedName}
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {resolvedName ? (
        <Button type="button" disabled={pending} onClick={handleSave}>
          {pending ? "Saving" : "Confirm & save"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !bankCode || accountNumber.length !== 10}
          onClick={handleVerify}
        >
          {pending ? "Verifying" : "Verify account"}
        </Button>
      )}
    </div>
  );
}
