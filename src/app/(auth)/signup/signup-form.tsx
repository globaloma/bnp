"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { signUp } from "../actions";
import type { AuthResult } from "@/lib/schemas/auth";
import { apply } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const fieldClass =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-destructive">{messages[0]}</p>;
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    signUp,
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const awaitingConfirmation = state?.ok === true;

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,42,68,0.5)]">
      <h1 className="text-xl font-semibold text-navy">Create your partner account</h1>
      <p className="mt-1 text-sm text-graphite">
        Set up your dashboard access. Your account starts in review while our
        team confirms fit, most partners are approved within 48 hours.
      </p>

      {awaitingConfirmation ? (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>{state.message ?? "Account created."}</p>
        </div>
      ) : (
        <>
          {state && !state.ok && !state.fieldErrors ? (
            <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <form action={formAction} className="mt-6 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="businessName">
                  Business name
                </label>
                <input
                  id="businessName"
                  name="businessName"
                  required
                  className={fieldClass}
                  placeholder="Your business name"
                />
                <FieldError messages={errors?.businessName} />
              </div>
              <div>
                <label className={labelClass} htmlFor="contactName">
                  Your full name
                </label>
                <input
                  id="contactName"
                  name="contactName"
                  required
                  className={fieldClass}
                  placeholder="First and last name"
                />
                <FieldError messages={errors?.contactName} />
              </div>
            </div>

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
              <FieldError messages={errors?.email} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className={fieldClass}
                  placeholder="0801 234 5678"
                />
                <FieldError messages={errors?.phone} />
              </div>
              <div>
                <label className={labelClass} htmlFor="category">
                  Product category
                </label>
                <select
                  id="category"
                  name="category"
                  defaultValue=""
                  className={cn(fieldClass, "appearance-none")}
                >
                  <option value="">Select</option>
                  {apply.form.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="password">
                Password
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

            <Button type="submit" size="xl" disabled={pending} className="mt-1 w-full">
              {pending ? "Creating account" : "Create account"}
            </Button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-graphite">
        Already a partner?{" "}
        <Link href="/login" className="font-semibold text-teal hover:text-teal-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
