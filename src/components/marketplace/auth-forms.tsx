"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormGuard } from "@/components/form-guard";
import { customerSignIn, customerSignUp, type AccountResult } from "@/app/marketplace/account/actions";
import { useShopHref } from "./shop-base";

const field =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const label = "mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-graphite uppercase";

function Error({ state, name }: { state: AccountResult | null; name: string }) {
  const msg = state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined;
  return msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null;
}

export function SignInForm({ next, linkError }: { next: string; linkError: boolean }) {
  const href = useShopHref();
  const [state, action, pending] = useActionState<AccountResult | null, FormData>(customerSignIn, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {linkError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          That link has expired or was already used. Sign in, or sign up again to get a new one.
        </p>
      ) : null}
      <div>
        <label className={label} htmlFor="si-email">
          Email
        </label>
        <input id="si-email" name="email" type="email" autoComplete="email" required className={field} />
        <Error state={state} name="email" />
      </div>
      <div>
        <label className={label} htmlFor="si-password">
          Password
        </label>
        <input id="si-password" name="password" type="password" autoComplete="current-password" required className={field} />
        <Error state={state} name="password" />
      </div>
      {state && !state.ok && !state.fieldErrors ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="h-11 rounded-md bg-gold text-sm font-bold text-navy hover:bg-gold-300 disabled:opacity-50">
        {pending ? "Signing in" : "Sign in"}
      </button>
      <p className="text-center text-sm text-graphite">
        New to BNP Shop?{" "}
        <Link href={href(`/account/signup?next=${encodeURIComponent(next)}`)} className="font-semibold text-teal-700 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const href = useShopHref();
  const [state, action, pending] = useActionState<AccountResult | null, FormData>(customerSignUp, null);
  if (state?.ok) {
    return (
      <div className="rounded-md bg-success/10 px-4 py-5 text-center text-sm text-navy">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1 text-graphite">{state.message}</p>
      </div>
    );
  }
  return (
    <form action={action} className="relative flex flex-col gap-4">
      <FormGuard form="signup" />
      <input type="hidden" name="next" value={next} />
      <div>
        <label className={label} htmlFor="su-name">
          Full name
        </label>
        <input id="su-name" name="fullName" autoComplete="name" required className={field} />
        <Error state={state} name="fullName" />
      </div>
      <div>
        <label className={label} htmlFor="su-phone">
          Phone
        </label>
        <input id="su-phone" name="phone" type="tel" autoComplete="tel" required placeholder="0801 234 5678" className={field} />
        <Error state={state} name="phone" />
      </div>
      <div>
        <label className={label} htmlFor="su-email">
          Email
        </label>
        <input id="su-email" name="email" type="email" autoComplete="email" required className={field} />
        <Error state={state} name="email" />
      </div>
      <div>
        <label className={label} htmlFor="su-password">
          Password
        </label>
        <input id="su-password" name="password" type="password" autoComplete="new-password" minLength={8} required className={field} />
        <Error state={state} name="password" />
      </div>
      {state && !state.ok && !state.fieldErrors ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="h-11 rounded-md bg-gold text-sm font-bold text-navy hover:bg-gold-300 disabled:opacity-50">
        {pending ? "Creating your account" : "Create account"}
      </button>
      <p className="text-center text-sm text-graphite">
        Already have an account?{" "}
        <Link href={href(`/account/login?next=${encodeURIComponent(next)}`)} className="font-semibold text-teal-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
