"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { submitWithoutReset } from "@/lib/submit-without-reset";
import { changePassword, updateProfile, updateStorefront } from "@/app/actions/settings";
import type { SettingsResult } from "@/lib/schemas/settings";
import type { Partner } from "@/types/db";
import { apply } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "./ui";
import { ImageUploadField } from "./image-upload";

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25 disabled:bg-stone/50 disabled:text-graphite";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-destructive">{messages[0]}</p>;
}

function useResultToast(state: SettingsResult | null) {
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else if (!state.fieldErrors) toast.error(state.error);
  }, [state]);
}

export function ProfileForm({
  partner,
  isFc,
}: {
  partner: Partner;
  isFc: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsResult | null, FormData>(
    updateProfile,
    null,
  );
  useResultToast(state);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Panel accent="teal">
      <h2 className="text-base font-semibold text-navy">Business profile</h2>
      <p className="mt-1 text-sm text-graphite">
        {isFc
          ? "How your fulfillment center appears to BNP and merchants."
          : "How your business appears on your storefront, receipts and to the BNP team."}
      </p>

      <form onSubmit={submitWithoutReset(formAction)} className="mt-5 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <ImageUploadField
            bucket="partner-logos"
            name="logoUrl"
            initialUrl={partner.logo_url ?? undefined}
            removable
          />
          <div className="text-sm">
            <p className="font-semibold text-navy">Business logo</p>
            <p className="mt-0.5 text-xs text-graphite">
              Square image, under 5MB. Click the box to upload.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="businessName">
              {isFc ? "Fulfillment center name" : "Business name"}
            </label>
            <input
              id="businessName"
              name="businessName"
              required
              defaultValue={partner.business_name}
              className={fieldClass}
            />
            <FieldError messages={errors?.businessName} />
          </div>
          <div>
            <label className={labelClass} htmlFor="contactName">
              Contact person
            </label>
            <input
              id="contactName"
              name="contactName"
              required
              defaultValue={partner.contact_name}
              className={fieldClass}
            />
            <FieldError messages={errors?.contactName} />
          </div>
          <div>
            <label className={labelClass} htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              defaultValue={partner.phone ?? ""}
              className={fieldClass}
            />
            <FieldError messages={errors?.phone} />
          </div>
          {isFc ? null : (
            <div>
              <label className={labelClass} htmlFor="category">
                Product category
              </label>
              <select
                id="category"
                name="category"
                defaultValue={partner.category ?? ""}
                className={cn(fieldClass, "appearance-none")}
              >
                <option value="">Select</option>
                {apply.form.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {partner.category &&
                !(apply.form.categories as readonly string[]).includes(partner.category) ? (
                  <option value={partner.category}>{partner.category}</option>
                ) : null}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="email">
              Login email
            </label>
            <input
              id="email"
              value={partner.email}
              disabled
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-mist">
              To change your login email, contact the BNP team.
            </p>
          </div>
        </div>

        {!isFc ? (
          <p className="text-xs text-mist">
            Changing your business name doesn&apos;t change your storefront
            link, so links you&apos;ve already shared keep working.
          </p>
        ) : null}

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save changes"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function StorefrontForm({
  partner,
  storefrontUrl,
}: {
  partner: Partner;
  storefrontUrl: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsResult | null, FormData>(
    updateStorefront,
    null,
  );
  useResultToast(state);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Panel accent="success">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy">Storefront</h2>
          <p className="mt-1 text-sm text-graphite">
            What customers see about your business on your store. Leave a field
            empty to hide it.
          </p>
        </div>
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-teal hover:text-teal-700"
        >
          View your store ↗
        </a>
      </div>

      <form onSubmit={submitWithoutReset(formAction)} className="mt-5 flex flex-col gap-4">
        <div>
          <label className={labelClass} htmlFor="description">
            About your store
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            defaultValue={partner.store_description ?? ""}
            placeholder="e.g. Handmade skincare from Lagos. Natural ingredients, delivered nationwide."
            className={cn(fieldClass, "h-auto py-2")}
          />
          <FieldError messages={errors?.description} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="whatsapp">
              WhatsApp for customers
            </label>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              defaultValue={partner.store_whatsapp ?? ""}
              placeholder="0801 234 5678"
              className={fieldClass}
            />
            <FieldError messages={errors?.whatsapp} />
          </div>
          <div>
            <label className={labelClass} htmlFor="instagram">
              Instagram
            </label>
            <input
              id="instagram"
              name="instagram"
              defaultValue={partner.store_instagram ? `@${partner.store_instagram}` : ""}
              placeholder="@yourstore"
              className={fieldClass}
            />
            <FieldError messages={errors?.instagram} />
          </div>
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving" : "Save storefront"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<SettingsResult | null, FormData>(
    changePassword,
    null,
  );
  useResultToast(state);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Panel accent="gold">
      <h2 className="text-base font-semibold text-navy">Change password</h2>
      <p className="mt-1 text-sm text-graphite">
        Enter your current password, then choose a new one.
      </p>

      <form
        ref={formRef}
        onSubmit={submitWithoutReset(formAction)}
        className="mt-5 flex flex-col gap-4"
      >
        <div className="sm:max-w-sm">
          <label className={labelClass} htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className={fieldClass}
          />
          <FieldError messages={errors?.currentPassword} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
              placeholder="At least 8 characters"
              className={fieldClass}
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
            />
            <FieldError messages={errors?.confirmPassword} />
          </div>
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Updating" : "Update password"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
