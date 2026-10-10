"use client";

import { useState, useTransition } from "react";
import { resendConfirmation } from "./actions";
import { cn } from "@/lib/utils";

export function ResendConfirmation({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await resendConfirmation(email));
          })
        }
        className="text-sm font-semibold text-teal hover:text-teal-700 disabled:opacity-60"
      >
        {pending ? "Sending" : "Resend confirmation email"}
      </button>
      {result ? (
        <p
          className={cn(
            "mt-1 text-xs",
            result.ok ? "text-success" : "text-destructive",
          )}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
