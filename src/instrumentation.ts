import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

// Server-side error monitoring. Does nothing until NEXT_PUBLIC_SENTRY_DSN is
// set, so local development and preview builds without it stay quiet.
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({ dsn, ...sentryOptions });
}

// Reports errors from server components, route handlers and server actions.
// The digest Next.js shows on error pages is attached, so a reference code a
// merchant quotes can be found in Sentry.
export const onRequestError = Sentry.captureRequestError;
