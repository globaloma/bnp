import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// For public, unauthenticated reads (the storefront) - no cookies, no
// session, just the anon key against the public storefront_* views.
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
