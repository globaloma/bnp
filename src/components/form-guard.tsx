"use client";

import { useEffect, useState } from "react";
import { getFormToken } from "@/app/actions/form-token";
import type { GuardedForm } from "@/lib/spam-guard";

/**
 * Drop inside a public <form>. Adds a hidden honeypot field and, for forms
 * that use one, a signed token fetched when the form loads (see
 * src/lib/spam-guard.ts). Renders nothing visible.
 */
export function FormGuard({ form }: { form: GuardedForm }) {
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    getFormToken(form)
      .then((t) => {
        if (!cancelled && t) setToken(t);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form]);

  return (
    <>
      <input type="hidden" name="_ft" value={token} />
      {/* Hidden from people (off-screen, skipped by keyboard and screen readers). */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company website
          <input type="text" name="company_url" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </>
  );
}
