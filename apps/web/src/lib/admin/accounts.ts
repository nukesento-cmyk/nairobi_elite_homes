import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { generatePassword, hashPassword, verifyPassword } from "./password";

/** Implemented by the real Postgres client, and by an in-memory one in tests. */
export type Db = {
  query<Row>(text: string, params?: unknown[]): Promise<Row[]>;
};

export type AdminRole = "superadmin" | "admin";

export type Admin = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  mustChangePassword: boolean;
  createdAt: string;
};

export class AdminError extends Error {}

const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
const SESSION_HOURS = 12;
export const SESSION_MAX_AGE = SESSION_HOURS * 60 * 60;

const emailSchema = z.email("Enter a valid email address.").trim().toLowerCase().max(200);
const nameSchema = z.string().trim().min(2, "Enter a name.").max(100);
const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(200);

const COLUMNS = `id, email, name, role,
  must_change_password AS "mustChangePassword", created_at AS "createdAt"`;

// Stands in for a real hash, so an unknown email takes as long to reject as a wrong password.
const UNKNOWN_ACCOUNT_HASH = hashPassword(generatePassword());

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AdminError(result.error.issues[0].message);
  return result.data;
}

function isDuplicate(error: unknown): boolean {
  return (error as { code?: string }).code === "23505";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// --- Permissions. The one rule that separates the roles lives here.

export function canDeleteAdmin(actor: Admin, target: Admin): boolean {
  return actor.role === "superadmin" && target.role === "admin";
}

export function canEditAdmin(actor: Admin, target: Admin): boolean {
  return actor.role === "superadmin" || target.role === "admin";
}

/** Resetting someone's password gives access to their account, so it isn't shared between peers. */
export function canResetPassword(actor: Admin, target: Admin): boolean {
  return actor.role === "superadmin" && target.role === "admin";
}

// --- Accounts

export async function listAdmins(db: Db): Promise<Admin[]> {
  return db.query<Admin>(
    `SELECT ${COLUMNS} FROM admins ORDER BY role = 'superadmin' DESC, created_at ASC`,
  );
}

async function getAdmin(db: Db, id: string): Promise<Admin> {
  if (!z.uuid().safeParse(id).success) throw new AdminError("That account no longer exists.");
  const [admin] = await db.query<Admin>(`SELECT ${COLUMNS} FROM admins WHERE id = $1`, [id]);
  if (!admin) throw new AdminError("That account no longer exists.");
  return admin;
}

/** Only ever creates the admin role, so a second SuperAdmin can't be made from here. */
export async function createAdmin(db: Db, input: { email: unknown; name: unknown }) {
  const email = parse(emailSchema, input.email);
  const name = parse(nameSchema, input.name);
  const temporaryPassword = generatePassword();
  try {
    const [admin] = await db.query<Admin>(
      `INSERT INTO admins (email, name, role, password_hash, must_change_password)
       VALUES ($1, $2, 'admin', $3, true) RETURNING ${COLUMNS}`,
      [email, name, await hashPassword(temporaryPassword)],
    );
    return { admin, temporaryPassword };
  } catch (error) {
    if (isDuplicate(error)) throw new AdminError("An account with that email already exists.");
    throw error;
  }
}

export async function updateAdmin(
  db: Db,
  actor: Admin,
  id: string,
  input: { email: unknown; name: unknown },
): Promise<void> {
  const target = await getAdmin(db, id);
  if (!canEditAdmin(actor, target)) throw new AdminError("You can't edit that account.");
  const email = parse(emailSchema, input.email);
  const name = parse(nameSchema, input.name);
  try {
    await db.query(`UPDATE admins SET email = $1, name = $2, updated_at = now() WHERE id = $3`, [
      email,
      name,
      id,
    ]);
  } catch (error) {
    if (isDuplicate(error)) throw new AdminError("An account with that email already exists.");
    throw error;
  }
}

export async function deleteAdmin(db: Db, actor: Admin, id: string): Promise<void> {
  const target = await getAdmin(db, id);
  if (!canDeleteAdmin(actor, target)) throw new AdminError("Only the SuperAdmin can delete admins.");
  // The role condition protects the SuperAdmin even if the checks above are ever changed.
  await db.query(`DELETE FROM admins WHERE id = $1 AND role = 'admin'`, [id]);
}

export async function resetPassword(db: Db, actor: Admin, id: string): Promise<string> {
  const target = await getAdmin(db, id);
  if (!canResetPassword(actor, target)) {
    throw new AdminError("Only the SuperAdmin can reset another admin's password.");
  }
  const temporaryPassword = generatePassword();
  await db.query(
    `UPDATE admins SET password_hash = $1, must_change_password = true, failed_logins = 0,
       locked_until = NULL, updated_at = now() WHERE id = $2`,
    [await hashPassword(temporaryPassword), id],
  );
  await db.query(`DELETE FROM admin_sessions WHERE admin_id = $1`, [id]);
  return temporaryPassword;
}

/** Signs out every other device, in case the old password was the reason for changing it. */
export async function changeOwnPassword(
  db: Db,
  actor: Admin,
  currentSessionToken: string,
  input: { current: unknown; next: unknown },
): Promise<void> {
  const next = parse(passwordSchema, input.next);
  const [row] = await db.query<{ hash: string }>(
    `SELECT password_hash AS hash FROM admins WHERE id = $1`,
    [actor.id],
  );
  if (!row || !(await verifyPassword(String(input.current), row.hash))) {
    throw new AdminError("Your current password isn't right.");
  }
  if (next === input.current) throw new AdminError("Choose a different password.");
  await db.query(
    `UPDATE admins SET password_hash = $1, must_change_password = false, updated_at = now()
     WHERE id = $2`,
    [await hashPassword(next), actor.id],
  );
  await db.query(`DELETE FROM admin_sessions WHERE admin_id = $1 AND token_hash <> $2`, [
    actor.id,
    hashToken(currentSessionToken),
  ]);
}

// --- Signing in

/**
 * The same error for every failure, so this can't be used to discover which emails have
 * accounts. Failures are counted in the database, which holds across server instances.
 */
export async function authenticate(
  db: Db,
  input: { email: unknown; password: unknown },
): Promise<Admin> {
  const failure = new AdminError("That email and password don't match.");
  const email = emailSchema.safeParse(input.email);
  const password = typeof input.password === "string" ? input.password : "";

  const [row] = email.success
    ? await db.query<{ id: string; hash: string; locked: boolean }>(
        `SELECT id, password_hash AS hash, COALESCE(locked_until > now(), false) AS locked
         FROM admins WHERE email = $1`,
        [email.data],
      )
    : [];

  const matches = await verifyPassword(password, row?.hash ?? (await UNKNOWN_ACCOUNT_HASH));
  if (!row || row.locked) throw failure;

  if (!matches) {
    await db.query(
      `UPDATE admins SET
         failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END,
         locked_until = CASE WHEN failed_logins + 1 >= $2
           THEN now() + make_interval(mins => $3) ELSE locked_until END
       WHERE id = $1`,
      [row.id, MAX_FAILED_LOGINS, LOCK_MINUTES],
    );
    throw failure;
  }

  await db.query(`UPDATE admins SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [row.id]);
  return getAdmin(db, row.id);
}

// --- Sessions. Only a hash of the token is stored, so a database leak can't be replayed.

export async function createSession(db: Db, adminId: string): Promise<string> {
  await db.query(`DELETE FROM admin_sessions WHERE expires_at <= now()`);
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO admin_sessions (token_hash, admin_id, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [hashToken(token), adminId, SESSION_HOURS],
  );
  return token;
}

/** Reads the role fresh on every request, so changes and deletions apply immediately. */
export async function findSessionAdmin(db: Db, token: string): Promise<Admin | null> {
  const [admin] = await db.query<Admin>(
    `SELECT a.id, a.email, a.name, a.role,
       a.must_change_password AS "mustChangePassword", a.created_at AS "createdAt"
     FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return admin ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [hashToken(token)]);
}
