import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Only the routes that actually care about the session need this. Keeping
// the marketing site out of the matcher means a Supabase misconfiguration
// can only ever break auth, never take the whole site down.
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
