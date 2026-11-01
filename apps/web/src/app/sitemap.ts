import type { MetadataRoute } from "next";

import { site } from "@/config/site";
import { getCommunities, getPublicListings } from "@/lib/cms";

const STATIC_ROUTES = ["/", "/homes", "/land", "/join"];

// Lists public pages only. Gated listings have no pages, and sample listings are
// excluded because they're marked noindex.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!site.url) return [];
  const absolute = (path: string) => new URL(path, site.url!).toString();

  const [communities, listings] = await Promise.all([getCommunities(), getPublicListings()]);
  return [
    ...STATIC_ROUTES.map((route) => ({ url: absolute(route) })),
    ...communities.map(({ slug }) => ({ url: absolute(`/communities/${slug}`) })),
    ...listings
      .filter((listing) => !listing.isSample)
      .map(({ slug, updatedAt }) => ({
        url: absolute(`/listings/${slug}`),
        lastModified: updatedAt,
      })),
  ];
}
