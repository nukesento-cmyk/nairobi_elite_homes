import "server-only";

import { cookies } from "next/headers";

import { db, isDatabaseConfigured } from "@/lib/db";

import { findSessionAdmin, SESSION_MAX_AGE, type Admin } from "./accounts";

const COOKIE = "neh_admin_session";

export { db, isDatabaseConfigured as isAdminConfigured };

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  const token = await getSessionToken();
  if (!token || !isDatabaseConfigured()) return null;
  return findSessionAdmin(db, token);
}

// Lax, not Strict: the redirect back from Google counts as coming from another site, and
// a Strict cookie wouldn't be sent, leaving the person looking signed out. Server actions
// still reject requests from other origins.
export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}
