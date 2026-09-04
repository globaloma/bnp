"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "../actions";
import type { AuthResult } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";

const fieldClass =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    signIn,
    null,
  );

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-[0_20px_60px_-20px_rgba(15,42,68,0.5)]">
      <h1 className="text-xl font-semibold text-navy">Partner login</h1>
      <p className="mt-1 text-sm text-graphite">
        Sign in to manage your inventory, orders and wallet.
      </p>

      {state && !state.ok ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
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
            autoComplete="current-password"
            className={fieldClass}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" size="xl" disabled={pending} className="mt-1 w-full">
          {pending ? "Signing in" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-graphite">
        New partner?{" "}
        <Link href="/signup" className="font-semibold text-teal hover:text-teal-700">
          Apply to join
        </Link>
      </p>
    </div>
  );
}
