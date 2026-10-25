import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where shop sign-up confirmation emails land: swaps the code in the link for
// a session, then continues to `next` inside the shop. On shop.<domain> this
// is /auth/callback (src/proxy.ts rewrites it here).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const base = request.headers.get("x-shop-base") ?? "/marketplace";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${proto}://${host}${base}`;
  const nextParam = searchParams.get("next") ?? "/account";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/account";

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  let failed = true;
  if (code) failed = Boolean((await supabase.auth.exchangeCodeForSession(code)).error);
  else if (tokenHash && type) failed = Boolean((await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error);

  return NextResponse.redirect(failed ? `${origin}/account/login?error=link` : `${origin}${next}`);
}
