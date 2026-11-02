import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authorizationUrl, isGoogleConfigured, startAttempt } from "@/lib/auth/google";

const ATTEMPT_COOKIE = "neh_google_attempt";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const audience = url.searchParams.get("for") === "staff" ? "staff" : "buyer";
  const home = audience === "staff" ? "/admin/login" : "/account";
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL(`${home}?error=not-configured`, url.origin));
  }

  const attempt = startAttempt(audience);
  (await cookies()).set(ATTEMPT_COOKIE, JSON.stringify(attempt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return NextResponse.redirect(
    authorizationUrl(attempt, `${url.origin}/api/auth/google/callback`, process.env.GOOGLE_CLIENT_ID ?? ""),
  );
}
