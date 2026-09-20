import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client. Bypasses RLS entirely - only ever call this from
// Server Actions or Route Handlers that have already done their own
// authorization checks in code (guest checkout, Paystack webhook). Never
// import this from a Client Component; `server-only` makes that a build
// error if it ever happens by accident.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
