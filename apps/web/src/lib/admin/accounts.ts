import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { generatePassword, hashPassword, verifyPassword } from "./password";

/** Implemented by the real Postgres client, and by an in-memory one in tests. */
export type Db = {
  query<Row>(text: string, params?: unknown[]): Promise<Row[]>;
};

export type AdminRole = "superadmin" | "admin" | "reviewer" | "caller";

export type Admin = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  /** Null only for the SuperAdmin, who stands above every brand. */
  brandId: string | null;
  createdBy: string | null;
  mustChangePassword: boolean;
  createdAt: string;
};

export class AdminError extends Error {}

const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
const SESSION_HOURS = 12;
export const SESSION_MAX_AGE = SESSION_HOURS * 60 * 60;

export const emailSchema = z.email("Enter a valid email address.").trim().toLowerCase().max(200);
export const nameSchema = z.string().trim().min(2, "Enter a name.").max(100);
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(200);

const COLUMNS = `id, email, name, role, brand_id AS "brandId", created_by AS "createdBy",
  must_change_password AS "mustChangePassword", created_at AS "createdAt"`;

// Stands in for a real hash, so an unknown email takes as long to reject as a wrong password.
const UNKNOWN_ACCOUNT_HASH = hashPassword(generatePassword());

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AdminError(result.error.issues[0].message);
  return result.data;
}

export function isDuplicate(error: unknown): boolean {
  return (error as { code?: string }).code === "23505";
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// --- Permissions. Who can manage whom lives here and nowhere else.

/**
 * The brand a person's work is limited to, or null for the SuperAdmin, who sees every brand.
 * Decided by role, so a missing brand on anyone else can never read as "all brands".
 */
export function brandScope(actor: Pick<Admin, "role" | "brandId">): string | null {
  if (actor.role === "superadmin") return null;
  if (!actor.brandId) throw new AdminError("Your account isn't linked to a brand.");
  return actor.brandId;
}

/** The roles this person can create. */
export function manageableRoles(actor: Pick<Admin, "role">): AdminRole[] {
  if (actor.role === "superadmin" || actor.role === "admin") return ["admin", "reviewer", "caller"];
  return [];
}

/**
 * Who can edit, delete and reset whom. Within a brand, admins look after every reviewer but
 * only the admins they added themselves, so a newer admin can't remove whoever added them.
 */
export function canManage(
  actor: Pick<Admin, "id" | "role" | "brandId">,
  target: Pick<Admin, "role" | "brandId" | "createdBy">,
): boolean {
  if (target.role === "superadmin") return false;
  if (actor.role === "superadmin") return true;
  if (actor.role !== "admin" || actor.brandId !== target.brandId) return false;
  return target.role === "reviewer" || target.role === "caller" || target.createdBy === actor.id;
}

/** Everyone can correct their own name and email. */
export function canEdit(actor: Admin, target: Admin): boolean {
  return actor.id === target.id || canManage(actor, target);
}

/** The original brand, the only one with leads for now. Also in src/lib/brands.ts and db/schema.sql. */
const LEADS_BRAND_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Who can work the call list. A caller does nothing else: every other permission here names the
 * roles it allows, so a new role starts with no access to anything.
 */
export function canWorkLeads(actor: Pick<Admin, "role" | "brandId">, brandId: string): boolean {
  return actor.role === "superadmin" || (actor.role === "caller" && actor.brandId === brandId);
}

/** Reviewers send properties for approval. Admins can approve, so theirs go straight up. */
export function canManageProperties(actor: Pick<Admin, "role">): boolean {
  return actor.role === "reviewer" || actor.role === "admin";
}

/** Only reviewers write blogs. */
export function canWritePosts(actor: Pick<Admin, "role">): boolean {
  return actor.role === "reviewer";
}

/** Approving reviewers' work, and handling requests for the community link. */
export function canReview(actor: Pick<Admin, "role">): boolean {
  return actor.role === "superadmin" || actor.role === "admin";
}

/** Reviewers tidy their own work. The SuperAdmin can take down anything. */
export function canRemoveContent(actor: Pick<Admin, "role">): boolean {
  return actor.role === "reviewer" || actor.role === "superadmin";
}

/** Everyone on the staff side can add a user. Each stays inside their own brand. */
export function canManageUsers(actor: Pick<Admin, "role">): boolean {
  return actor.role === "superadmin" || actor.role === "admin" || actor.role === "reviewer";
}

export function canManageGroups(actor: Pick<Admin, "role">): boolean {
  return actor.role === "superadmin" || actor.role === "admin";
}

// --- Accounts

/** The SuperAdmin sees everyone, admins see their brand, and reviewers just themselves. */
export async function listAdmins(db: Db, actor: Admin): Promise<Admin[]> {
  const order = `ORDER BY id = $1 DESC, role = 'admin' DESC, created_at ASC`;
  if (actor.role === "superadmin") {
    return db.query<Admin>(`SELECT ${COLUMNS} FROM admins ${order}`, [actor.id]);
  }
  if (actor.role === "admin") {
    return db.query<Admin>(`SELECT ${COLUMNS} FROM admins WHERE brand_id = $2 ${order}`, [actor.id, brandScope(actor)]);
  }
  return db.query<Admin>(`SELECT ${COLUMNS} FROM admins WHERE id = $1 ${order}`, [actor.id]);
}

async function getAdmin(db: Db, id: string): Promise<Admin> {
  if (!z.uuid().safeParse(id).success) throw new AdminError("That account no longer exists.");
  const [admin] = await db.query<Admin>(`SELECT ${COLUMNS} FROM admins WHERE id = $1`, [id]);
  if (!admin) throw new AdminError("That account no longer exists.");
  return admin;
}

/** A second SuperAdmin can't be made from here: it's in nobody's manageable roles. */
export async function createAdmin(
  db: Db,
  actor: Admin,
  input: { email: unknown; name: unknown; role: unknown; brandId?: unknown },
) {
  const role = input.role as AdminRole;
  if (!manageableRoles(actor).includes(role)) {
    throw new AdminError("You can't create that kind of account.");
  }
  const email = parse(emailSchema, input.email);
  const name = parse(nameSchema, input.name);
  // Admins always add to their own brand, whatever the request says.
  const brandId = actor.role === "superadmin" ? input.brandId : brandScope(actor);
  if (!z.uuid().safeParse(brandId).success) throw new AdminError("Choose a brand.");
  if (role === "caller" && brandId !== LEADS_BRAND_ID) {
    throw new AdminError("Leads belong to the main brand for now, so callers have to be added there.");
  }
  const temporaryPassword = generatePassword();
  try {
    const [admin] = await db.query<Admin>(
      `INSERT INTO admins (email, name, role, password_hash, must_change_password, brand_id, created_by)
       SELECT $1, $2, $3, $4, true, brands.id, $6::uuid FROM brands WHERE brands.id = $5 RETURNING ${COLUMNS}`,
      [email, name, role, await hashPassword(temporaryPassword), brandId, actor.id],
    );
    if (!admin) throw new AdminError("Choose a brand.");
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
  if (!canEdit(actor, target)) throw new AdminError("You can't edit that account.");
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
  if (!canManage(actor, target)) throw new AdminError("You can't delete that account.");
  // The role condition protects the SuperAdmin even if the checks above are ever changed.
  await db.query(`DELETE FROM admins WHERE id = $1 AND role <> 'superadmin'`, [id]);
}

export async function resetPassword(db: Db, actor: Admin, id: string): Promise<string> {
  const target = await getAdmin(db, id);
  if (!canManage(actor, target)) throw new AdminError("You can't reset that password.");
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
 * Returns the id of the matching row. The table is only ever one of these fixed names.
 */
export async function verifyCredentials(
  db: Db,
  table: "admins" | "buyers",
  input: { email: unknown; password: unknown },
): Promise<string> {
  const failure = new AdminError("That email and password don't match.");
  const email = emailSchema.safeParse(input.email);
  const password = typeof input.password === "string" ? input.password : "";

  const [row] = email.success
    ? await db.query<{ id: string; hash: string | null; locked: boolean }>(
        `SELECT id, password_hash AS hash, COALESCE(locked_until > now(), false) AS locked
         FROM ${table} WHERE email = $1`,
        [email.data],
      )
    : [];

  const matches = await verifyPassword(password, row?.hash ?? (await UNKNOWN_ACCOUNT_HASH));
  if (!row || row.locked || !row.hash) throw failure;

  if (!matches) {
    await db.query(
      `UPDATE ${table} SET
         failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END,
         locked_until = CASE WHEN failed_logins + 1 >= $2
           THEN now() + make_interval(mins => $3) ELSE locked_until END
       WHERE id = $1`,
      [row.id, MAX_FAILED_LOGINS, LOCK_MINUTES],
    );
    throw failure;
  }

  await db.query(`UPDATE ${table} SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [row.id]);
  return row.id;
}

export async function authenticate(
  db: Db,
  input: { email: unknown; password: unknown },
): Promise<Admin> {
  return getAdmin(db, await verifyCredentials(db, "admins", input));
}

/**
 * Staff signing in with Google: the account must already exist, created by whoever manages
 * it. A temporary password nobody needs any more is replaced with one nobody knows.
 */
export async function authenticateWithGoogle(db: Db, email: string): Promise<Admin | null> {
  const [row] = await db.query<{ id: string; mustChange: boolean }>(
    `SELECT id, must_change_password AS "mustChange" FROM admins WHERE email = $1`,
    [email.toLowerCase()],
  );
  if (!row) return null;
  if (row.mustChange) {
    await db.query(
      `UPDATE admins SET password_hash = $1, must_change_password = false, updated_at = now()
       WHERE id = $2`,
      [await hashPassword(generatePassword()), row.id],
    );
  }
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
    `SELECT a.id, a.email, a.name, a.role, a.brand_id AS "brandId", a.created_by AS "createdBy",
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
