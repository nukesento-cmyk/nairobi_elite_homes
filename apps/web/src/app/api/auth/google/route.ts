import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authorizationUrl, isGoogleConfigured, startAttempt } from "@/lib/auth/google";
import { googleRedirectOrigin, parseBase } from "@/lib/brand-site";

const ATTEMPT_COOKIE = "neh_google_attempt";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const audience = url.searchParams.get("for") === "staff" ? "staff" : "buyer";
  const base = parseBase(url.searchParams.get("base"));
  const home = audience === "staff" ? "/admin/login" : `${base}/login`;
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL(`${home}?error=not-configured`, url.origin));
  }

  // Only the main domain is registered with Google, so a brand's domain goes by way of it.
  const redirectOrigin = googleRedirectOrigin(url.origin, process.env.NEXT_PUBLIC_SITE_URL);
  const attempt = startAttempt(audience, { base, relayFrom: redirectOrigin === url.origin ? undefined : url.host });
  (await cookies()).set(ATTEMPT_COOKIE, JSON.stringify(attempt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return NextResponse.redirect(
    authorizationUrl(attempt, `${redirectOrigin}/api/auth/google/callback`, process.env.GOOGLE_CLIENT_ID ?? ""),
  );
}
