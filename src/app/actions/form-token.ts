"use server";

import { issueFormToken, type GuardedForm } from "@/lib/spam-guard";

const TOKEN_FORMS: GuardedForm[] = ["apply", "signup", "forgot"];

/** Called by <FormGuard> when a protected form loads in the browser. */
export async function getFormToken(form: GuardedForm): Promise<string | null> {
  return TOKEN_FORMS.includes(form) ? issueFormToken(form) : null;
}
