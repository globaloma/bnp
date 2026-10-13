"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { requestPasswordReset } from "../actions";
import type { AuthResult } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";

const fieldClass =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function ForgotPasswordForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    requestPasswordReset,
    null,
  );

  const sent = state?.ok === true;
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,42,68,0.5)]">
      <h1 className="text-xl font-semibold text-navy">Reset your password</h1>
      <p className="mt-1 text-sm text-graphite">
        Enter the email you signed up with and we&apos;ll send you a link to
        choose a new password.
      </p>

      {linkExpired && !state ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          That reset link is invalid or has expired. Request a new one below.
        </p>
      ) : null}

      {sent ? (
        <div className="mt-6 rounded-lg border border-teal/30 bg-teal/5 p-5 text-sm text-navy">
          <div className="flex items-center gap-2">
            <Mail className="size-5 shrink-0 text-teal" />
            <p className="text-base font-semibold">Check your inbox</p>
          </div>
          <p className="mt-2 text-graphite">
            If an account exists for{" "}
            <span className="font-semibold text-navy">{state.pendingEmail}</span>,
            we&apos;ve sent a link to reset your password. The link expires
            in 1 hour.
          </p>
          <p className="mt-3 text-xs text-mist">
            Didn&apos;t get it? Check your spam or promotions folder, or try
            again in a few minutes.
          </p>
        </div>
      ) : (
        <>
          {state && !state.ok && !state.fieldErrors ? (
            <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <form action={formAction} className="mt-6 flex flex-col gap-4">
            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className={fieldClass}
                placeholder="you@business.com"
              />
              {errors?.email?.length ? (
                <p className="mt-1 text-xs text-destructive">{errors.email[0]}</p>
              ) : null}
            </div>
            <Button type="submit" size="xl" disabled={pending} className="mt-1 w-full">
              {pending ? "Sending link" : "Send reset link"}
            </Button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-graphite">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-teal hover:text-teal-700">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
