import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/fc"];
const AUTH_PATHS = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Missing config should not take the whole site down. Auth-gated pages
    // simply render in a signed-out state until the env vars are set.
    console.error(
      "[proxy] Supabase env vars are missing, skipping session refresh.",
    );
    return response;
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] =
    null;

  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (error) {
    // A network blip or Supabase outage should not take the whole site
    // down. Treat the request as signed-out for this pass.
    console.error("[proxy] Supabase auth.getUser() failed:", error);
    return response;
  }

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PATHS.includes(pathname)) {
    // Already signed in and browsing straight to /login or /signup, send
    // them to the dashboard that matches their role.
    try {
      const { data: partner } = await supabase
        .from("partners")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const url = request.nextUrl.clone();
      url.pathname = partner?.role === "fulfillment_center" ? "/fc" : "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    } catch (error) {
      console.error("[proxy] Supabase partners lookup failed:", error);
      return response;
    }
  }

  return response;
}
