import type { Metadata } from "next";
import { MessageSquareWarning, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { OrderFeedback } from "@/lib/delivery-feedback";
import { isWhatsAppConfigured } from "@/lib/whatsapp";
import { formatDate } from "@/lib/format";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/dashboard/ui";
import { ResolveButton } from "./resolve-button";

export const metadata: Metadata = { title: "Feedback" };

type InboundMessage = {
  id: string;
  from_phone: string;
  body: string;
  feedback_id: string | null;
  created_at: string;
};

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const [{ data: feedbackData }, { data: partnerData }, { data: inboundData }] = await Promise.all([
    supabase.from("order_feedback").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("partners").select("id, business_name"),
    supabase.from("whatsapp_inbound").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const feedback = (feedbackData ?? []) as OrderFeedback[];
  const inbound = (inboundData ?? []) as InboundMessage[];
  const partnerName = new Map((partnerData ?? []).map((p) => [p.id, p.business_name as string]));
  const repliesByFeedback = new Map<string, InboundMessage[]>();
  for (const m of inbound) {
    if (!m.feedback_id) continue;
    repliesByFeedback.set(m.feedback_id, [...(repliesByFeedback.get(m.feedback_id) ?? []), m]);
  }

  const issues = feedback.filter(
    (f) => f.received_ok === false || (repliesByFeedback.has(f.id) && f.received_ok !== true),
  );
  const openIssues = issues.filter((f) => !f.issue_resolved_at);
  const reviews = feedback.filter((f) => f.received_ok === true);
  const awaiting = feedback.filter((f) => !f.responded_at);
  const failedSends = feedback.filter(
    (f) => f.whatsapp_status === "failed" || f.whatsapp_status === "skipped",
  );
  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Feedback"
        description="Delivery confirmations, reviews, and problems customers report after delivery."
      />

      {!isWhatsAppConfigured() ? (
        <Panel accent="destructive">
          <p className="text-sm text-navy">
            WhatsApp is not connected yet. Add <code>TWILIO_ACCOUNT_SID</code>,{" "}
            <code>TWILIO_AUTH_TOKEN</code> and <code>TWILIO_WHATSAPP_FROM</code> to the
            environment. Delivered orders are still tracked here, but no messages go out.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open issues" value={String(openIssues.length)} accent="destructive" />
        <StatCard label="Awaiting response" value={String(awaiting.length)} />
        <StatCard label="Reviews" value={String(reviews.length)} />
        <StatCard label="Average rating" value={avgRating ? `${avgRating.toFixed(1)} / 5` : "-"} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-navy">Issues</h2>
        {issues.length === 0 ? (
          <EmptyState
            icon={<MessageSquareWarning className="size-8" />}
            title="No issues reported"
            body="When a customer reports a problem after delivery it shows up here, and Ops gets an email right away."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {issues.map((f) => (
              <li key={f.id}>
                <Panel accent={f.issue_resolved_at ? "success" : "destructive"}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-semibold text-navy">
                        {f.order_ref} · {partnerName.get(f.partner_id) ?? "Unknown merchant"}
                      </div>
                      <div className="text-xs text-mist">
                        {f.customer_name} · {f.customer_phone ?? "No phone"} ·{" "}
                        {formatDate(f.responded_at ?? f.created_at)}
                      </div>
                    </div>
                    <ResolveButton id={f.id} resolved={Boolean(f.issue_resolved_at)} />
                  </div>
                  {f.issue ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-navy">{f.issue}</p>
                  ) : null}
                  {(repliesByFeedback.get(f.id) ?? []).map((m) => (
                    <p key={m.id} className="mt-2 whitespace-pre-wrap rounded-md bg-cream px-3 py-2 text-sm text-navy">
                      <span className="mr-2 text-xs text-mist">WhatsApp · {formatDate(m.created_at)}</span>
                      {m.body}
                    </p>
                  ))}
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-navy">Reviews</h2>
        {reviews.length === 0 ? (
          <EmptyState
            icon={<Star className="size-8" />}
            title="No reviews yet"
            body="Customers leave a rating when they confirm their order arrived well."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {reviews.map((f) => (
              <li key={f.id} className="rounded-lg border border-stone bg-card px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-navy">
                    {f.customer_name} · {f.order_ref} · {partnerName.get(f.partner_id) ?? "Unknown merchant"}
                  </div>
                  <div className="flex items-center gap-0.5 text-gold" aria-label={`${f.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={n <= (f.rating ?? 0) ? "size-4 fill-current" : "size-4 text-stone"} />
                    ))}
                  </div>
                </div>
                {f.review ? <p className="mt-1 text-sm text-graphite">{f.review}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {failedSends.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-navy">Messages not sent</h2>
          <ul className="flex flex-col gap-2">
            {failedSends.map((f) => (
              <li key={f.id} className="rounded-lg border border-stone bg-card px-4 py-3 text-sm">
                <span className="font-medium text-navy">{f.order_ref}</span>
                <span className="text-graphite"> · {f.customer_name} · </span>
                <span className="text-destructive">{f.whatsapp_error ?? f.whatsapp_status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

    </div>
  );
}
