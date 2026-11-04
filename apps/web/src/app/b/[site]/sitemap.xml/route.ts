import { getBrandListings, getBrandPosts, getBrandSite } from "@/lib/brand-site-data";

type RouteProps = { params: Promise<{ site: string }> };

const STATIC_PATHS = ["", "/homes", "/land", "/blog", "/join", "/contact", "/privacy"];

export async function GET(_: Request, { params }: RouteProps) {
  const site = await getBrandSite((await params).site);
  if (!site?.origin) return new Response(null, { status: 404 });
  const [listings, posts] = await Promise.all([getBrandListings(site.id), getBrandPosts(site.id)]);
  const paths = [
    ...STATIC_PATHS,
    ...listings.map(({ slug }) => `/listings/${slug}`),
    ...posts.map(({ slug }) => `/blog/${slug}`),
  ];
  // Slugs and domains only hold letters, numbers, dots and hyphens, so none need escaping.
  const urls = paths.map((path) => `<url><loc>${site.origin}${path}</loc></url>`).join("");
  const xmlns = ["http:", "", "www.sitemaps.org", "schemas", "sitemap", "0.9"].join("/");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="${xmlns}">${urls}</urlset>`, {
    headers: { "content-type": "application/xml" },
  });
}
