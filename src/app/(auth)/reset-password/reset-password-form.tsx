"use client";

import { useActionState } from "react";
import { updatePassword } from "../actions";
import { submitWithoutReset } from "@/lib/submit-without-reset";
import type { AuthResult } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";

const fieldClass =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-destructive">{messages[0]}</p>;
}

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    updatePassword,
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,42,68,0.5)]">
      <h1 className="text-xl font-semibold text-navy">Choose a new password</h1>
      <p className="mt-1 text-sm text-graphite">
        Setting a new password for{" "}
        <span className="font-semibold text-navy">{email}</span>.
      </p>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <form onSubmit={submitWithoutReset(formAction)} className="mt-6 flex flex-col gap-4">
        <div>
          <label className={labelClass} htmlFor="password">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className={fieldClass}
            placeholder="At least 8 characters"
          />
          <FieldError messages={errors?.password} />
        </div>
        <div>
          <label className={labelClass} htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className={fieldClass}
            placeholder="Type it again"
          />
          <FieldError messages={errors?.confirmPassword} />
        </div>
        <Button type="submit" size="xl" disabled={pending} className="mt-1 w-full">
          {pending ? "Saving" : "Save new password"}
        </Button>
      </form>
    </div>
  );
}
