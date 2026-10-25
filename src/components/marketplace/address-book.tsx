"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAddress, makeDefaultAddress, saveAddress, type AccountResult } from "@/app/marketplace/account/actions";

type Address = { id: string; label: string; full_name: string; phone: string; address: string; is_default: boolean };

const field =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none placeholder:text-mist focus-visible:border-teal";

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(addresses.length === 0);
  const [pending, start] = useTransition();
  const [state, action, saving] = useActionState<AccountResult | null, FormData>(saveAddress, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdding(false);
      router.refresh();
    }
  }, [state, router]);

  function run(fn: () => Promise<AccountResult>) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Done");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const err = (name: string) => (state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined);

  return (
    <div className="p-4">
      {addresses.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-md border border-stone p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-navy">
                {a.label}
                {a.is_default ? <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[10px] text-teal-700">Default</span> : null}
              </p>
              <p className="mt-1 text-graphite">
                {a.full_name}, {a.phone}
              </p>
              <p className="text-mist">{a.address}</p>
              <div className="mt-2 flex gap-3 text-xs font-semibold">
                {!a.is_default ? (
                  <button type="button" disabled={pending} onClick={() => run(() => makeDefaultAddress(a.id))} className="text-teal-700 hover:underline">
                    Make default
                  </button>
                ) : null}
                <button type="button" disabled={pending} onClick={() => run(() => deleteAddress(a.id))} className="text-destructive hover:underline">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <form action={action} className="mt-4 grid max-w-lg gap-3 sm:grid-cols-2">
          <input name="label" placeholder="Label, e.g. Home or Office" className={field} />
          <div>
            <input name="fullName" placeholder="Full name" required className={field} />
            {err("fullName") ? <p className="mt-1 text-xs text-destructive">{err("fullName")}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <input name="phone" type="tel" placeholder="Phone" required className={field} />
            {err("phone") ? <p className="mt-1 text-xs text-destructive">{err("phone")}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <textarea name="address" rows={3} required placeholder="House number, street, area, city, state" className={`${field} h-auto py-2`} />
            {err("address") ? <p className="mt-1 text-xs text-destructive">{err("address")}</p> : null}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="h-10 rounded-md bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Saving" : "Save address"}
            </button>
            {addresses.length > 0 ? (
              <button type="button" onClick={() => setAdding(false)} className="text-sm font-semibold text-graphite hover:underline">
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-4 text-sm font-semibold text-teal-700 hover:underline">
          + Add an address
        </button>
      )}
    </div>
  );
}
