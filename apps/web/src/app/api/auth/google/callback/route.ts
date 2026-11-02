import { timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authenticateWithGoogle, createSession } from "@/lib/admin/accounts";
import { setSessionCookie } from "@/lib/admin/session";
import { exchangeCode, type OAuthAttempt } from "@/lib/auth/google";
import { setBuyerCookie } from "@/lib/auth/buyer-session";
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
  const store = await cookies();
  const raw = store.get(ATTEMPT_COOKIE)?.value;
  store.delete({ name: ATTEMPT_COOKIE, path: "/api/auth/google" });

  let attempt: OAuthAttempt | null = null;
  try {
    attempt = raw ? (JSON.parse(raw) as OAuthAttempt) : null;
  } catch {}

  const home = attempt?.audience === "staff" ? "/admin/login" : "/account";
  const fail = (reason: string) => NextResponse.redirect(new URL(`${home}?error=${reason}`, url.origin));

  // The state proves this browser started the sign-in, which stops a forged callback.
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!attempt || !state || !code || !sameValue(state, attempt.state)) return fail("google-failed");
  if (!isDatabaseConfigured()) return fail("not-configured");

  const profile = await exchangeCode(code, attempt, `${url.origin}/api/auth/google/callback`).catch(() => null);
  if (!profile) return fail("google-failed");

  if (attempt.audience === "staff") {
    const admin = await authenticateWithGoogle(db, profile.email);
    if (!admin) return fail("no-staff-account");
    await setSessionCookie(await createSession(db, admin.id));
    return NextResponse.redirect(new URL("/admin", url.origin));
  }

  const buyer = await upsertBuyer(db, profile);
  await setBuyerCookie(await createBuyerSession(db, buyer.id));
  return NextResponse.redirect(new URL("/account", url.origin));
}
