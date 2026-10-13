import * as Sentry from "@sentry/nextjs";

/**
 * Called from error boundaries. Errors that came from the server carry a
 * digest and were already reported there by onRequestError, so only
 * browser-side errors are sent from here, to avoid duplicates.
 */
export function reportError(error: Error & { digest?: string }) {
  console.error(error);
  if (!error.digest) Sentry.captureException(error);
}
