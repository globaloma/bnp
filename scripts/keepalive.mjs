#!/usr/bin/env node
// Pings the Supabase project's REST API so the free-tier project doesn't
// get auto-paused after a week of inactivity. Read-only, no auth session
// required, touches no data. Run on a schedule (see
// .github/workflows/keepalive.yml) — up to 4x/day is plenty.
//
// Usage: node scripts/keepalive.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
// the environment (already in .env.local locally; set as repo secrets for
// the GitHub Actions workflow).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "keepalive: missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  process.exit(1);
}

// A cheap, RLS-safe read: anon has no session, so this returns an empty
// array rather than real data, but it's a genuine query against the
// database, which is what counts as activity.
const endpoint = `${url}/rest/v1/partners?select=id&limit=1`;

try {
  const res = await fetch(endpoint, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.error(`keepalive: unexpected status ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  console.log(`keepalive: ok (${res.status}) at ${new Date().toISOString()}`);
} catch (err) {
  console.error("keepalive: request failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
