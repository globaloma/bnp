import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// BNP Shop, the customer marketplace in src/app/marketplace, is served two ways:
//   * on shop.<domain> (shop.bnpfulfillment.com, shop.localhost:3100):
//     "/p/123" is rewritten to "/marketplace/p/123", so shop URLs stay clean;
//   * under /marketplace in local development; on the live main domain,
//     /marketplace/... redirects to the subdomain.
// The x-shop-base header tells the pages which prefix their links need: ""
// on the subdomain, "/marketplace" on the main domain. Every other request
// on the main domain passes straight through untouched.

function isShopHost(host: string) {
  return host.split(":")[0].startsWith("shop.");
}

function isMarketplacePath(pathname: string) {
  return pathname === "/marketplace" || pathname.startsWith("/marketplace/");
}

/** Keeps a signed-in shopper's session fresh (Supabase rotates tokens). */
async function withShopperSession(request: NextRequest, makeResponse: (req: NextRequest) => NextResponse) {
  let response = makeResponse(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = makeResponse(request);
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch {
    // A Supabase blip shouldn't take the shop down; the page treats it as signed out.
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Next's own files, API routes and static files (anything with an extension).
  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/") || /\.[a-z0-9]+$/i.test(pathname)) {
    return NextResponse.next();
  }
  const host = request.headers.get("host") ?? "";

  if (isShopHost(host)) {
    // On the subdomain, /marketplace/... is the same page under a longer name.
    if (isMarketplacePath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice("/marketplace".length) || "/";
      return NextResponse.redirect(url, 308);
    }
    return withShopperSession(request, (req) => {
      const url = req.nextUrl.clone();
      url.pathname = `/marketplace${pathname === "/" ? "" : pathname}`;
      url.search = search;
      const headers = new Headers(req.headers);
      headers.set("x-shop-base", "");
      return NextResponse.rewrite(url, { request: { headers } });
    });
  }

  if (isMarketplacePath(pathname)) {
    // On the live site the shop has one address: send /marketplace/... to
    // shop.bnpfulfillment.com/... (query kept, so payment and sign-up links
    // made before the switch still land). Local development keeps /marketplace.
    if (host.split(":")[0].endsWith("bnpfulfillment.com")) {
      const target = new URL(`https://shop.bnpfulfillment.com${pathname.slice("/marketplace".length) || "/"}`);
      target.search = search;
      return NextResponse.redirect(target, 308);
    }
    return withShopperSession(request, (req) => {
      const headers = new Headers(req.headers);
      headers.set("x-shop-base", "/marketplace");
      return NextResponse.next({ request: { headers } });
    });
  }
  return NextResponse.next();
}
