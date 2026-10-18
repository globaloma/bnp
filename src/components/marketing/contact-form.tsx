"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { apply } from "@/lib/site-content";
import type { ApplicationResult } from "@/lib/schemas/application";
import { submitApplication } from "@/app/actions/apply";
import { submitWithoutReset } from "@/lib/submit-without-reset";
import { cn } from "@/lib/utils";
import { FormGuard } from "@/components/form-guard";
import { Button } from "@/components/ui/button";

const fieldClass =
  "h-12 w-full rounded-lg border border-stone bg-white px-4 text-[15px] text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/20";
const labelClass = "mb-1.5 block text-sm font-semibold text-navy";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-destructive">{messages[0]}</p>;
}

/**
 * Merchant enquiry form, emailed to the BNP team. On the quote page it also
 * carries the calculator's estimate so the team sees the numbers.
 */
export function ContactForm({
  variant = "contact",
  title = apply.form.title,
  subtitle = apply.form.subtitle,
  quoteSummary,
}: {
  variant?: "contact" | "quote";
  title?: string;
  subtitle?: string;
  quoteSummary?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();
  const [state, formAction, pending] = useActionState<ApplicationResult | null, FormData>(
    submitApplication,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const succeeded = state?.ok === true;

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      toast.success(apply.form.success);
    } else if (state && !state.ok && !state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <div className="rounded-2xl border border-stone bg-white p-6 shadow-[0_24px_60px_-32px_rgba(15,42,68,0.35)] sm:p-10">
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">{title}</h2>
      <p className="mt-2 text-[15px] text-graphite">{subtitle}</p>

      {succeeded ? (
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-5 text-[15px] text-success">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>{apply.form.success}</p>
        </div>
      ) : (
        <form
          ref={formRef}
          onSubmit={submitWithoutReset(formAction)}
          className="relative mt-8 flex flex-col gap-5"
        >
          <FormGuard form="apply" />
          <input type="hidden" name="kind" value={variant} />
          {quoteSummary ? <input type="hidden" name="quote" value={quoteSummary} /> : null}
          <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor={`${uid}-website`}>Leave this field empty</label>
            <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`${uid}-fullName`}>
                Your full name
              </label>
              <input id={`${uid}-fullName`} name="fullName" required className={fieldClass} placeholder="First and last name" />
              <FieldError messages={errors?.fullName} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${uid}-businessName`}>
                Business name
              </label>
              <input id={`${uid}-businessName`} name="businessName" required className={fieldClass} placeholder="Your brand" />
              <FieldError messages={errors?.businessName} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${uid}-email`}>
                Email
              </label>
              <input id={`${uid}-email`} name="email" type="email" required className={fieldClass} placeholder="you@business.com" />
              <FieldError messages={errors?.email} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${uid}-phone`}>
                Phone or WhatsApp
              </label>
              <input id={`${uid}-phone`} name="phone" type="tel" required className={fieldClass} placeholder="0801 234 5678" />
              <FieldError messages={errors?.phone} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${uid}-category`}>
                What do you sell?
              </label>
              <select id={`${uid}-category`} name="category" defaultValue="" className={cn(fieldClass, "appearance-none")}>
                <option value="">Select a category</option>
                {apply.form.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${uid}-location`}>
                Where do you want your stock?
              </label>
              <select
                id={`${uid}-location`}
                name="location"
                required
                defaultValue={apply.form.locations[0]}
                className={cn(fieldClass, "appearance-none")}
              >
                {apply.form.locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <FieldError messages={errors?.location} />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor={`${uid}-volume`}>
              Orders per month
            </label>
            <select id={`${uid}-volume`} name="volume" defaultValue="" className={cn(fieldClass, "appearance-none")}>
              <option value="">Select a range</option>
              {apply.form.volumes.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor={`${uid}-note`}>
              {variant === "quote" ? "Anything else we should know?" : "How can we help?"}
            </label>
            <textarea
              id={`${uid}-note`}
              name="note"
              rows={4}
              className={cn(fieldClass, "h-auto resize-y py-3")}
              placeholder="What do you sell, where are your customers, anything special about your products?"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-mist">{apply.form.disclaimer}</p>
            <Button type="submit" size="xl" disabled={pending} className="shrink-0 px-8">
              <Send />
              {pending ? "Sending" : variant === "quote" ? "Request my quote" : "Send message"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
