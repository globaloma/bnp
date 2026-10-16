"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setIssueResolved(feedbackId: string, resolved: boolean): Promise<ActionResult> {
  // RLS only lets admins update order_feedback.
  const supabase = await createClient();
  const { error } = await supabase
    .from("order_feedback")
    .update({ issue_resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", feedbackId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/feedback");
  return { ok: true };
}
