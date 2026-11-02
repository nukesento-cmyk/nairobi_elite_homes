import { randomBytes } from "node:crypto";

import { hashToken, type Db } from "@/lib/admin/accounts";
import type { GoogleProfile } from "@/lib/auth/google";

export type Buyer = { id: string; email: string; name: string };

const SESSION_DAYS = 30;
export const BUYER_SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

/** Free for anyone with a Google account. The first sign-in creates the buyer. */
export async function upsertBuyer(db: Db, profile: GoogleProfile): Promise<Buyer> {
  const [buyer] = await db.query<Buyer>(
    `INSERT INTO buyers (google_sub, email, name) VALUES ($1, $2, $3)
     ON CONFLICT (google_sub) DO UPDATE
       SET email = EXCLUDED.email, name = EXCLUDED.name, last_login_at = now()
     RETURNING id, email, name`,
    [profile.sub, profile.email.toLowerCase(), profile.name],
  );
  return buyer;
}

export async function createBuyerSession(db: Db, buyerId: string): Promise<string> {
  await db.query(`DELETE FROM buyer_sessions WHERE expires_at <= now()`);
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO buyer_sessions (token_hash, buyer_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), buyerId, SESSION_DAYS],
  );
  return token;
}

export async function findSessionBuyer(db: Db, token: string): Promise<Buyer | null> {
  const [buyer] = await db.query<Buyer>(
    `SELECT b.id, b.email, b.name FROM buyer_sessions s JOIN buyers b ON b.id = s.buyer_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return buyer ?? null;
}

export async function deleteBuyerSession(db: Db, token: string): Promise<void> {
  await db.query(`DELETE FROM buyer_sessions WHERE token_hash = $1`, [hashToken(token)]);
}
