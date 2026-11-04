import { timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authenticateWithGoogle, createSession } from "@/lib/admin/accounts";
import { setSessionCookie } from "@/lib/admin/session";
import { exchangeCode, type OAuthAttempt } from "@/lib/auth/google";
import { setBuyerCookie } from "@/lib/auth/buyer-session";
import { bareHost, brandOrigin, googleRedirectOrigin, parseBase, relayHost } from "@/lib/brand-site";
import { brandIdForHost, brandIdForVisitor, DEFAULT_BRAND_ID } from "@/lib/brands";
import { createBuyerSession, upsertBuyer } from "@/lib/buyers";
import { db, isDatabaseConfigured } from "@/lib/db";

const ATTEMPT_COOKIE = "neh_google_attempt";

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Google answers on the main domain. If this sign-in began on a brand's domain, pass it on,
  // since only that domain holds the cookie that can finish it. Only a brand's registered
  // domain is ever a destination, so this can't be used to send anyone elsewhere.
  const target = relayHost(url.searchParams.get("state"), url.host);
  if (target) {
    const brandId = isDatabaseConfigured() ? await brandIdForHost(db, target).catch(() => DEFAULT_BRAND_ID) : DEFAULT_BRAND_ID;
    if (brandId !== DEFAULT_BRAND_ID && bareHost(target)) {
      return NextResponse.redirect(new URL(`/api/auth/google/callback${url.search}`, brandOrigin(target)));
    }
    return NextResponse.redirect(new URL("/login?error=google-failed", url.origin));
  }

  const store = await cookies();
  const raw = store.get(ATTEMPT_COOKIE)?.value;
  store.delete({ name: ATTEMPT_COOKIE, path: "/api/auth/google" });

  let attempt: OAuthAttempt | null = null;
  try {
    attempt = raw ? (JSON.parse(raw) as OAuthAttempt) : null;
  } catch {}

  // Both of these offer a password, so a failed Google sign-in always has somewhere to go.
  const base = parseBase(attempt?.base);
  const home = attempt?.audience === "staff" ? "/admin/login" : `${base}/login`;
  const redirectOrigin = googleRedirectOrigin(url.origin, process.env.NEXT_PUBLIC_SITE_URL);
  const fail = (reason: string) => NextResponse.redirect(new URL(`${home}?error=${reason}`, url.origin));

  // The state proves this browser started the sign-in, which stops a forged callback.
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!attempt || !state || !code || !sameValue(state, attempt.state)) return fail("google-failed");
  if (!isDatabaseConfigured()) return fail("not-configured");

  const profile = await exchangeCode(code, attempt, `${redirectOrigin}/api/auth/google/callback`).catch(() => null);
  if (!profile) return fail("google-failed");

  try {
    if (attempt.audience === "staff") {
      const admin = await authenticateWithGoogle(db, profile.email);
      if (!admin) return fail("no-staff-account");
      await setSessionCookie(await createSession(db, admin.id));
      return NextResponse.redirect(new URL("/admin", url.origin));
    }

    const buyer = await upsertBuyer(db, profile, await brandIdForVisitor(db, base, url.host));
    if (!buyer) return fail("google-failed");
    await setBuyerCookie(await createBuyerSession(db, buyer.id));
    return NextResponse.redirect(new URL(`${base}/account`, url.origin));
  } catch {
    console.error("Finishing a Google sign-in failed.");
    return fail("google-failed");
  }
}
