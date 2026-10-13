import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in areas, auth flows, and per-customer storefront pages have
      // nothing useful for search engines and shouldn't show up in results.
      disallow: [
        "/dashboard",
        "/fc",
        "/admin",
        "/api/",
        "/auth/",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/feedback/",
        "/store/*/checkout",
        "/store/*/confirm",
        "/store/*/track",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
