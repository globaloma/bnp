"use server";

import { after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertOpsOfIssue } from "@/lib/delivery-feedback";

export type FeedbackResult =
  | { ok: true; receivedOk: boolean }
  | { ok: false; error: string };

const feedbackSchema = z.discriminatedUnion("receivedOk", [
  z.object({
    receivedOk: z.literal("yes"),
    rating: z.coerce.number().int().min(1, "Pick a rating").max(5),
    review: z.string().trim().max(1000).optional(),
  }),
  z.object({
    receivedOk: z.literal("no"),
    issue: z.string().trim().min(5, "Tell us a little about what went wrong").max(2000),
  }),
]);

// The token in the URL is the only credential here (guest customers have no
// login), so it's long and random, and a response can only be recorded once.
export async function submitFeedback(
  token: string,
  _prev: FeedbackResult | null,
  formData: FormData,
): Promise<FeedbackResult> {
  const parsed = feedbackSchema.safeParse({
    receivedOk: formData.get("receivedOk"),
    rating: formData.get("rating") ?? undefined,
    review: formData.get("review") || undefined,
    issue: formData.get("issue") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your answers." };
  }

  const admin = createAdminClient();
  const { data: feedback } = await admin
    .from("order_feedback")
    .select("id, partner_id, order_ref, customer_name, customer_phone, responded_at")
    .eq("token", token)
    .maybeSingle();

  if (!feedback) return { ok: false, error: "This link is not valid." };
  if (feedback.responded_at) return { ok: false, error: "You've already responded. Thank you!" };

  const d = parsed.data;
  const now = new Date().toISOString();
  const update =
    d.receivedOk === "yes"
      ? { received_ok: true, rating: d.rating, review: d.review || null, responded_at: now }
      : { received_ok: false, issue: d.issue, responded_at: now };

  const { error } = await admin
    .from("order_feedback")
    .update(update)
    .eq("id", feedback.id)
    .is("responded_at", null);
  if (error) return { ok: false, error: "Could not save your response, please try again." };

  if (d.receivedOk === "no") {
    after(() => alertOpsOfIssue({ feedback, issue: d.issue, source: "feedback page" }));
  }

  return { ok: true, receivedOk: d.receivedOk === "yes" };
}
