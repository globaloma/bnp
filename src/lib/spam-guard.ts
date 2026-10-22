import "server-only";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Spam and abuse protection for public forms, in three layers:
//  1. a hidden "honeypot" field that people never see but bots fill in;
//  2. a signed form token fetched when the form loads in a browser, which
//     also rejects submissions faster than a person could type;
//  3. per-visitor rate limits stored in Postgres (check_rate_limit, 0020).

export type GuardedForm =
  | "apply"
  | "signup"
  | "login"
  | "forgot"
  | "resend"
  | "track"
  | "checkout"
  | "quote";

const LIMITS: Record<GuardedForm, { limit: number; windowSeconds: number }> = {
  apply: { limit: 3, windowSeconds: 60 * 60 },
  signup: { limit: 5, windowSeconds: 60 * 60 },
  login: { limit: 10, windowSeconds: 15 * 60 },
  forgot: { limit: 5, windowSeconds: 60 * 60 },
  resend: { limit: 5, windowSeconds: 60 * 60 },
  track: { limit: 20, windowSeconds: 10 * 60 },
  checkout: { limit: 10, windowSeconds: 10 * 60 },
  quote: { limit: 40, windowSeconds: 10 * 60 },
};

/** Forms that need a form token (bots mostly target these). */
const MIN_FILL_MS: Partial<Record<GuardedForm, number>> = {
  apply: 3000,
  signup: 3000,
  forgot: 1500,
};

const TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000;

function secret(): string {
  // A dedicated secret if one is set; otherwise derived from the service
  // role key, which is already a server-only secret, so no extra setup.
  const base = process.env.FORM_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return crypto.createHash("sha256").update(`bnp-form-guard:${base}`).digest("hex");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function issueFormToken(form: GuardedForm): string {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${sign(`${form}:${issuedAt}`)}`;
}

function tokenProblem(form: GuardedForm, token: unknown): "missing" | "fast" | null {
  const minMs = MIN_FILL_MS[form];
  if (minMs === undefined) return null;
  if (typeof token !== "string") return "missing";

  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return "missing";

  const expected = Buffer.from(sign(`${form}:${issuedAt}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return "missing";
  }

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age > TOKEN_MAX_AGE_MS) return "missing";
  if (age < minMs) return "fast";
  return null;
}

/**
 * Records a hit for this visitor and returns false once they're over the
 * form's limit. Fails open: if the database can't be reached, real people
 * aren't locked out.
 */
export async function withinRateLimit(form: GuardedForm, extraKey?: string): Promise<boolean> {
  const { limit, windowSeconds } = LIMITS[form];
  const visitor = `ip:${await clientIp()}${extraKey ? `:${extraKey.toLowerCase()}` : ""}`;
  return withinLimit(form, visitor, limit, windowSeconds);
}

/**
 * Generic limiter for anything that isn't keyed by the visitor's IP, e.g.
 * WhatsApp replies keyed by the sender's phone. The key is hashed before
 * it's stored. Fails open, like withinRateLimit.
 */
export async function withinLimit(
  scope: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("check_rate_limit", {
      p_key: `${scope}:${sign(key).slice(0, 32)}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[spam-guard] rate limit check failed:", error.message);
      return true;
    }
    return data !== false;
  } catch (err) {
    console.error("[spam-guard] rate limit check failed:", err);
    return true;
  }
}

export type GuardVerdict =
  | { ok: true }
  /** Looks like a bot: pretend it worked, so it doesn't learn to adapt. */
  | { ok: false; reason: "bot" }
  /** Probably a person: show them this message. */
  | { ok: false; reason: "limited" | "retry"; message: string };

/** Runs all three checks for a form submission. */
export async function guardSubmission(form: GuardedForm, formData: FormData): Promise<GuardVerdict> {
  if (String(formData.get("company_url") ?? "") !== "") return { ok: false, reason: "bot" };

  // A missing token is usually a bot posting directly, but could be a person
  // on a slow connection whose form hadn't finished loading, so tell them
  // rather than silently dropping it. Bots don't read the message anyway.
  const problem = tokenProblem(form, formData.get("_ft"));
  if (problem) {
    return {
      ok: false,
      reason: "retry",
      message:
        problem === "fast"
          ? "That was very quick. Please check your details and try again."
          : "This form didn't finish loading. Please refresh the page and try again.",
    };
  }

  if (!(await withinRateLimit(form))) {
    return {
      ok: false,
      reason: "limited",
      message: "Too many attempts from your connection. Please wait a while and try again.",
    };
  }

  return { ok: true };
}

/** Escapes text for safe insertion into an HTML email. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
