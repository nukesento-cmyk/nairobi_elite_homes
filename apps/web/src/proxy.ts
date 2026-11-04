import { NextResponse, type NextRequest } from "next/server";

import { bareHost, isMainHost } from "@/lib/brand-site";

/**
 * Serves a brand's domain from its own pages under /b/, keeping the address people see. The
 * main site, its prerendered pages and everything under /admin and /api are left as they are.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  if (isMainHost(host, process.env.NEXT_PUBLIC_SITE_URL)) {
    // /b/slug is the public address of a brand with no domain. Domain-based pages only exist
    // for the domain itself, where their links work.
    if (/^\/b\/[^/]*\./.test(pathname)) return new NextResponse(null, { status: 404 });
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/b/${bareHost(host)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api/|admin|_next/|brand/|images/|favicon|.*\\.(?:svg|png|jpe?g|webp|avif|ico|css|js|woff2?|map)$).*)"],
};
