import "server-only";

import { cookies } from "next/headers";
import postgres from "postgres";

import { findSessionAdmin, SESSION_MAX_AGE, type Admin, type Db } from "./accounts";

const COOKIE = "neh_admin_session";

// One small connection per server instance, reused between requests. Prepared statements
// are off so this also works through a pooled connection, such as Neon's.
const store = globalThis as typeof globalThis & { nehAdminSql?: ReturnType<typeof postgres> };

export function isAdminConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export const db: Db = {
  async query<Row>(text: string, params: unknown[] = []) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    store.nehAdminSql ??= postgres(url, { max: 3, prepare: false, idle_timeout: 20 });
    return (await store.nehAdminSql.unsafe(text, params as never[])) as unknown as Row[];
  },
};

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  const token = await getSessionToken();
  if (!token || !isAdminConfigured()) return null;
  return findSessionAdmin(db, token);
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}
