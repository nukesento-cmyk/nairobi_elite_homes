import type { MetadataRoute } from "next";

import { site } from "@/config/site";
import { getBlogPosts, getCommunities, getPublicListings } from "@/lib/cms";

const STATIC_ROUTES = ["/", "/homes", "/land", "/join", "/areas", "/contact", "/blog", "/privacy"];

// Lists public pages only. Gated listings have no pages, and sample listings are
// excluded because they're marked noindex.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!site.url) return [];
  const absolute = (path: string) => new URL(path, site.url!).toString();

  const [communities, listings, posts] = await Promise.all([
    getCommunities(),
    getPublicListings(),
    getBlogPosts(),
  ]);
  return [
    ...STATIC_ROUTES.map((route) => ({ url: absolute(route) })),
    ...communities.map(({ slug }) => ({ url: absolute(`/communities/${slug}`) })),
    ...posts.map(({ slug, updatedAt }) => ({
      url: absolute(`/blog/${slug}`),
      lastModified: new Date(updatedAt).toISOString(),
    })),
    ...listings
      .filter((listing) => !listing.isSample)
      .map(({ slug, updatedAt }) => ({
        url: absolute(`/listings/${slug}`),
        lastModified: updatedAt,
      })),
  ];
}
