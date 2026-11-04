import type { Metadata } from "next";

import type { BrandSite } from "@/lib/brand-site-data";

type BrandPage = { title?: string; description?: string; path: string; image?: string | null };

/**
 * A brand's pages carry its own name, and its own address when it has a domain. On /b/slug
 * they point at that address too, so search engines list each page once.
 */
export function brandMetadata(site: BrandSite, { title, description, path, image }: BrandPage): Metadata {
  const fullTitle = title ? `${title} | ${site.name}` : site.name;
  const summary = description ?? site.tagline ?? undefined;
  const canonical = site.origin ? `${site.origin}${path}` : `${site.base}${path}`;
  const picture = image ?? site.logoUrl;
  return {
    title: { absolute: fullTitle },
    description: summary,
    alternates: { canonical: canonical || "/" },
    openGraph: {
      type: "website",
      siteName: site.name,
      title: fullTitle,
      description: summary,
      url: canonical || "/",
      images: picture ? [{ url: picture }] : undefined,
    },
  };
}
