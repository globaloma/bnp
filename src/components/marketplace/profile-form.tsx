"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateProfile, type AccountResult } from "@/app/marketplace/account/actions";

const field =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none focus-visible:border-teal";
const label = "mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-graphite uppercase";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState<AccountResult | null, FormData>(updateProfile, null);
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved");
    else if (state && !state.ok) toast.error(state.error);
  }, [state]);
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <div>
        <label className={label} htmlFor="pf-name">
          Full name
        </label>
        <input id="pf-name" name="fullName" defaultValue={name} required className={field} />
      </div>
      <div>
        <label className={label} htmlFor="pf-phone">
          Phone
        </label>
        <input id="pf-phone" name="phone" type="tel" defaultValue={phone} className={field} />
      </div>
      <div>
        <span className={label}>Email</span>
        <p className="text-sm text-graphite">{email}</p>
      </div>
      <button type="submit" disabled={pending} className="h-10 w-fit rounded-md bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Saving" : "Save"}
      </button>
    </form>
  );
}
