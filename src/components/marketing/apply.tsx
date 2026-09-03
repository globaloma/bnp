"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apply } from "@/lib/site-content";
import type { ApplicationResult } from "@/lib/schemas/application";
import { submitApplication } from "@/app/actions/apply";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";
import { Icon } from "./icon";

const fieldClass =
  "h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white outline-none transition-colors placeholder:text-mist/60 focus-visible:border-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300/30";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-mist";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-300">{messages[0]}</p>;
}

export function Apply() {
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();
  const [state, formAction, pending] = useActionState<
    ApplicationResult | null,
    FormData
  >(submitApplication, null);

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
    <section id="apply" className="bg-cream py-20 sm:py-28">
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.25fr] lg:items-start">
        <div>
          <SectionHeading
            label={apply.label}
            title={apply.title}
            description={apply.description}
          />
          <ul className="mt-8 flex flex-col">
            {apply.perks.map((perk) => (
              <li
                key={perk.title}
                className="flex gap-3 border-b border-stone py-3.5 last:border-b-0"
              >
                <Icon name={perk.icon} className="mt-0.5 size-5 shrink-0 text-teal" />
                <div>
                  <span className="block text-sm font-semibold text-navy">
                    {perk.title}
                  </span>
                  <span className="text-sm text-graphite">{perk.body}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Reveal className="rounded-2xl bg-navy p-6 shadow-[0_20px_60px_-20px_rgba(15,42,68,0.5)] sm:p-8">
          <h3 className="text-lg font-semibold text-white">
            {apply.form.title}
          </h3>
          <p className="mt-1 text-sm text-mist">{apply.form.subtitle}</p>

          {succeeded ? (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-success">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <p>{apply.form.success}</p>
            </div>
          ) : (
            <form ref={formRef} action={formAction} className="mt-6 flex flex-col gap-4">
              <div
                aria-hidden
                className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
              >
                <label htmlFor={`${uid}-website`}>Leave this field empty</label>
                <input
                  id={`${uid}-website`}
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor={`${uid}-businessName`}>
                    Business name
                  </label>
                  <input
                    id={`${uid}-businessName`}
                    name="businessName"
                    required
                    className={fieldClass}
                    placeholder="Your business name"
                  />
                  <FieldError messages={errors?.businessName} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`${uid}-fullName`}>
                    Your full name
                  </label>
                  <input
                    id={`${uid}-fullName`}
                    name="fullName"
                    required
                    className={fieldClass}
                    placeholder="First and last name"
                  />
                  <FieldError messages={errors?.fullName} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor={`${uid}-email`}>
                    Email
                  </label>
                  <input
                    id={`${uid}-email`}
                    name="email"
                    type="email"
                    required
                    className={fieldClass}
                    placeholder="you@business.com"
                  />
                  <FieldError messages={errors?.email} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`${uid}-phone`}>
                    Phone
                  </label>
                  <input
                    id={`${uid}-phone`}
                    name="phone"
                    type="tel"
                    required
                    className={fieldClass}
                    placeholder="0801 234 5678"
                  />
                  <FieldError messages={errors?.phone} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor={`${uid}-category`}>
                    Product category
                  </label>
                  <select
                    id={`${uid}-category`}
                    name="category"
                    className={cn(fieldClass, "appearance-none")}
                    defaultValue=""
                  >
                    <option value="" className="bg-navy">
                      Select a category
                    </option>
                    {apply.form.categories.map((c) => (
                      <option key={c} value={c} className="bg-navy">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor={`${uid}-location`}>
                    Preferred location
                  </label>
                  <select
                    id={`${uid}-location`}
                    name="location"
                    required
                    className={cn(fieldClass, "appearance-none")}
                    defaultValue=""
                  >
                    <option value="" className="bg-navy">
                      Select a location
                    </option>
                    {apply.form.locations.map((l) => (
                      <option key={l} value={l} className="bg-navy">
                        {l}
                      </option>
                    ))}
                  </select>
                  <FieldError messages={errors?.location} />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor={`${uid}-volume`}>
                  Monthly order volume
                </label>
                <select
                  id={`${uid}-volume`}
                  name="volume"
                  className={cn(fieldClass, "appearance-none")}
                  defaultValue=""
                >
                  <option value="" className="bg-navy">
                    Select a range
                  </option>
                  {apply.form.volumes.map((v) => (
                    <option key={v} value={v} className="bg-navy">
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor={`${uid}-note`}>
                  Tell us about your business
                </label>
                <textarea
                  id={`${uid}-note`}
                  name="note"
                  rows={3}
                  className={cn(fieldClass, "h-auto resize-y py-2.5")}
                  placeholder="What do you sell? Where are your customers? Any specific needs?"
                />
              </div>

              <Button
                type="submit"
                size="xl"
                disabled={pending}
                className="mt-1 w-full bg-teal text-white hover:bg-teal-300"
              >
                {pending ? "Submitting" : "Submit application"}
              </Button>
              <p className="text-center text-xs text-mist">
                {apply.form.disclaimer}
              </p>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
