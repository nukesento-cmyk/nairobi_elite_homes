import { randomBytes } from "node:crypto";

import { z } from "zod";

import {
  AdminError,
  brandScope,
  canManageUsers,
  emailSchema,
  hashToken,
  isDuplicate,
  nameSchema,
  parse,
  passwordSchema,
  verifyCredentials,
  type Admin,
  type Db,
} from "@/lib/admin/accounts";
import { generatePassword, hashPassword, verifyPassword } from "@/lib/admin/password";
import type { GoogleProfile } from "@/lib/auth/google";
import { targetBrandId } from "@/lib/brands";

export type Buyer = {
  id: string;
  email: string;
  name: string;
  brandId: string;
  mustChangePassword: boolean;
  hasPassword: boolean;
};

export type UserRow = Buyer & { signsInWithGoogle: boolean; createdAt: string | Date };

const SESSION_DAYS = 30;
export const BUYER_SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

const columns = (table = "buyers") => `${table}.id, ${table}.email, ${table}.name, ${table}.brand_id AS "brandId",
  ${table}.must_change_password AS "mustChangePassword", ${table}.password_hash IS NOT NULL AS "hasPassword"`;

/**
 * Google vouches for the email, so it finds an account staff created and links to it. Anyone
 * else gets a free account with the brand they signed up on. Null when that email is already
 * linked to a different Google account, which the caller treats as a failed sign-in.
 */
export async function upsertBuyer(db: Db, profile: GoogleProfile, brandId: string): Promise<Buyer | null> {
  const email = profile.email.toLowerCase();
  const [known] = await db.query<Buyer>(
    `UPDATE buyers SET name = $2, last_login_at = now() WHERE google_sub = $1 RETURNING ${columns()}`,
    [profile.sub, profile.name],
  );
  if (known) return known;

  const [match] = await db.query<{ id: string; googleSub: string | null; mustChange: boolean }>(
    `SELECT id, google_sub AS "googleSub", must_change_password AS "mustChange" FROM buyers WHERE email = $1`,
    [email],
  );
  if (match?.googleSub) return null;
  if (match) {
    // A temporary password nobody needs any more is replaced with one nobody knows.
    const [linked] = await db.query<Buyer>(
      `UPDATE buyers SET google_sub = $1, last_login_at = now(),
         password_hash = CASE WHEN must_change_password THEN $2 ELSE password_hash END,
         must_change_password = false, failed_logins = 0, locked_until = NULL
       WHERE id = $3 RETURNING ${columns()}`,
      [profile.sub, match.mustChange ? await hashPassword(generatePassword()) : null, match.id],
    );
    return linked;
  }

  const [created] = await db.query<Buyer>(
    `INSERT INTO buyers (google_sub, email, name, brand_id) VALUES ($1, $2, $3, $4) RETURNING ${columns()}`,
    [profile.sub, email, profile.name, brandId],
  );
  return created;
}

// --- Signing in with a password. Accounts with no password simply never match.

export async function authenticateBuyer(db: Db, input: { email: unknown; password: unknown }): Promise<Buyer> {
  const id = await verifyCredentials(db, "buyers", input);
  const [buyer] = await db.query<Buyer>(
    `UPDATE buyers SET last_login_at = now() WHERE id = $1 RETURNING ${columns()}`,
    [id],
  );
  return buyer;
}

/** Signs out every other device, in case the old password was the reason for changing it. */
export async function changeBuyerPassword(
  db: Db,
  buyer: Pick<Buyer, "id">,
  currentSessionToken: string,
  input: { current: unknown; next: unknown },
): Promise<void> {
  const next = parse(passwordSchema, input.next);
  const [row] = await db.query<{ hash: string | null }>(`SELECT password_hash AS hash FROM buyers WHERE id = $1`, [buyer.id]);
  if (!row?.hash || !(await verifyPassword(String(input.current), row.hash))) {
    throw new AdminError("Your current password isn't right.");
  }
  if (next === input.current) throw new AdminError("Choose a different password.");
  await db.query(`UPDATE buyers SET password_hash = $1, must_change_password = false WHERE id = $2`, [
    await hashPassword(next),
    buyer.id,
  ]);
  await db.query(`DELETE FROM buyer_sessions WHERE buyer_id = $1 AND token_hash <> $2`, [
    buyer.id,
    hashToken(currentSessionToken),
  ]);
}

// --- Staff managing users, always within their own brand. The SuperAdmin sees every brand.

function requireAllowed(actor: Admin): void {
  if (!canManageUsers(actor)) throw new AdminError("You can't manage users.");
}

const USER_LIMIT = 200;

export async function listUsers(db: Db, actor: Admin): Promise<UserRow[]> {
  requireAllowed(actor);
  return db.query<UserRow>(
    `SELECT ${columns()}, google_sub IS NOT NULL AS "signsInWithGoogle", created_at AS "createdAt"
     FROM buyers WHERE ($1::uuid IS NULL OR brand_id = $1::uuid) ORDER BY created_at DESC LIMIT ${USER_LIMIT}`,
    [brandScope(actor)],
  );
}

export async function createUser(
  db: Db,
  actor: Admin,
  input: { email: unknown; name: unknown; brandId?: unknown },
): Promise<{ user: Buyer; temporaryPassword: string }> {
  requireAllowed(actor);
  const email = parse(emailSchema, input.email);
  const name = parse(nameSchema, input.name);
  const brandId = await targetBrandId(db, actor, input.brandId);
  const temporaryPassword = generatePassword();
  try {
    const [user] = await db.query<Buyer>(
      `INSERT INTO buyers (email, name, brand_id, password_hash, must_change_password, created_by)
       VALUES ($1, $2, $3, $4, true, $5) RETURNING ${columns()}`,
      [email, name, brandId, await hashPassword(temporaryPassword), actor.id],
    );
    return { user, temporaryPassword };
  } catch (error) {
    if (isDuplicate(error)) throw new AdminError("An account with that email already exists.");
    throw error;
  }
}

function assertUserId(id: string): void {
  if (!z.uuid().safeParse(id).success) throw new AdminError("That user no longer exists.");
}

export async function resetUserPassword(db: Db, actor: Admin, id: string): Promise<string> {
  requireAllowed(actor);
  assertUserId(id);
  const temporaryPassword = generatePassword();
  const rows = await db.query(
    `UPDATE buyers SET password_hash = $1, must_change_password = true, failed_logins = 0, locked_until = NULL
     WHERE id = $2 AND ($3::uuid IS NULL OR brand_id = $3::uuid) RETURNING id`,
    [await hashPassword(temporaryPassword), id, brandScope(actor)],
  );
  if (rows.length === 0) throw new AdminError("That user no longer exists.");
  await db.query(`DELETE FROM buyer_sessions WHERE buyer_id = $1`, [id]);
  return temporaryPassword;
}

export async function deleteUser(db: Db, actor: Admin, id: string): Promise<void> {
  requireAllowed(actor);
  assertUserId(id);
  const rows = await db.query(
    `DELETE FROM buyers WHERE id = $1 AND ($2::uuid IS NULL OR brand_id = $2::uuid) RETURNING id`,
    [id, brandScope(actor)],
  );
  if (rows.length === 0) throw new AdminError("That user no longer exists.");
}

// --- Sessions

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
    `SELECT ${columns("b")} FROM buyer_sessions s JOIN buyers b ON b.id = s.buyer_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return buyer ?? null;
}

export async function deleteBuyerSession(db: Db, token: string): Promise<void> {
  await db.query(`DELETE FROM buyer_sessions WHERE token_hash = $1`, [hashToken(token)]);
}
