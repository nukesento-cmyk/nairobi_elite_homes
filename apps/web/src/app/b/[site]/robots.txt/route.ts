import { getBrandSite } from "@/lib/brand-site-data";

type RouteProps = { params: Promise<{ site: string }> };

export async function GET(_: Request, { params }: RouteProps) {
  const site = await getBrandSite((await params).site);
  if (!site?.origin) return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /account\nDisallow: /login\n\nSitemap: ${site.origin}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
