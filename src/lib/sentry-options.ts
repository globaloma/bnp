import type { BrowserOptions } from "@sentry/nextjs";

// Shared by the server and browser Sentry setup. Sentry v11 collects a lot
// by default (cookies, request bodies, user info, query data, local variable
// values); BNP handles customer names, phones and addresses at checkout and
// passwords on the auth forms, so all of it is switched off. Reports carry
// the error, stack trace, page URL path and environment, nothing more.
/** Drops everything after "?" or "#": reset codes, payment refs, form values. */
function withoutQuery(url: string): string {
  return url.split(/[?#]/)[0];
}

export const sentryOptions: Pick<
  BrowserOptions,
  "tracesSampleRate" | "dataCollection" | "environment" | "beforeSend" | "beforeBreadcrumb"
> = {
  environment:
    process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // Errors only, so the free plan's quota goes on real problems.
  tracesSampleRate: 0,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    genAI: { inputs: false, outputs: false },
    graphQL: { document: false, variables: false },
  },
  // dataCollection doesn't cover everything: the Next.js integration adds the
  // full request path (query string included) to its own context. Strip
  // query strings from every URL on the event as a last step.
  beforeSend(event) {
    if (event.request) {
      if (event.request.url) event.request.url = withoutQuery(event.request.url);
      delete event.request.query_string;
      delete event.request.cookies;
      delete event.request.data;
    }
    const nextjs = event.contexts?.nextjs as { request_path?: unknown } | undefined;
    if (nextjs && typeof nextjs.request_path === "string") {
      nextjs.request_path = withoutQuery(nextjs.request_path);
    }
    if (event.transaction) event.transaction = withoutQuery(event.transaction);
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    const data = breadcrumb.data as Record<string, unknown> | undefined;
    for (const key of ["url", "from", "to"]) {
      if (data && typeof data[key] === "string") data[key] = withoutQuery(data[key] as string);
    }
    return breadcrumb;
  },
};
