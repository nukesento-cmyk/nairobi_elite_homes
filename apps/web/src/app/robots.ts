import type { MetadataRoute } from "next";

import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  // A staging address has no site URL set, and shouldn't be indexed with sample listings.
  if (!site.url) return { rules: { userAgent: "*", disallow: "/" } };

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/account", "/login"] },
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
