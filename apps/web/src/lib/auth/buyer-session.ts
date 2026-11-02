import "server-only";

import { cookies } from "next/headers";

import { BUYER_SESSION_MAX_AGE, findSessionBuyer, type Buyer } from "@/lib/buyers";
import { db, isDatabaseConfigured } from "@/lib/db";

const COOKIE = "neh_buyer_session";

export async function getBuyerToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function getCurrentBuyer(): Promise<Buyer | null> {
  const token = await getBuyerToken();
  if (!token || !isDatabaseConfigured()) return null;
  return findSessionBuyer(db, token);
}

export async function setBuyerCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: BUYER_SESSION_MAX_AGE,
  });
}

export async function clearBuyerCookie(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/" });
}
