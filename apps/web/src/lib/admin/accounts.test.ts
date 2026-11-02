// @vitest-environment node
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AdminError,
  authenticate,
  authenticateWithGoogle,
  canManage,
  changeOwnPassword,
  createAdmin,
  createSession,
  deleteAdmin,
  deleteSession,
  findSessionAdmin,
  listAdmins,
  resetPassword,
  updateAdmin,
  type Admin,
  type Db,
} from "./accounts";
import { hashPassword, verifyPassword } from "./password";

const SCHEMA = readFileSync("db/schema.sql", "utf8");
const SUPER_PASSWORD = "super-secret-password";

let db: Db;
let pg: PGlite;
let superadmin: Admin;
let adminOne: Admin;
let adminTwo: Admin;
let reviewer: Admin;

// Password hashing is deliberately slow, and each test starts a fresh database.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(SCHEMA);
  db = { query: async <Row>(text: string, params?: unknown[]) => (await pg.query<Row>(text, params)).rows };

  await db.query(
    `INSERT INTO admins (email, name, role, password_hash, must_change_password)
     VALUES ('super@example.com', 'Super', 'superadmin', $1, false)`,
    [await hashPassword(SUPER_PASSWORD)],
  );
  [superadmin] = await db.query<Admin>(
    `SELECT id, email, name, role, must_change_password AS "mustChangePassword", created_at AS "createdAt" FROM admins`,
  );
  adminOne = (await createAdmin(db, superadmin, { email: "One@Example.com", name: "One", role: "admin" })).admin;
  adminTwo = (await createAdmin(db, superadmin, { email: "two@example.com", name: "Two", role: "admin" })).admin;
  reviewer = (await createAdmin(db, adminOne, { email: "rev@example.com", name: "Rev", role: "reviewer" })).admin;
});

const emails = async () => (await listAdmins(db, superadmin)).map((admin) => admin.email);

describe("who can manage whom", () => {
  it("lets the SuperAdmin create, edit, reset and delete admins", async () => {
    const { admin } = await createAdmin(db, superadmin, { email: "new@example.com", name: "New", role: "admin" });
    await updateAdmin(db, superadmin, admin.id, { email: "new@example.com", name: "Renamed" });
    await resetPassword(db, superadmin, admin.id);
    await deleteAdmin(db, superadmin, admin.id);
    expect(await emails()).not.toContain("new@example.com");
  });

  it("lets an admin create, edit, reset and delete reviewers", async () => {
    const { admin } = await createAdmin(db, adminOne, { email: "r2@example.com", name: "R2", role: "reviewer" });
    await updateAdmin(db, adminOne, admin.id, { email: "r2@example.com", name: "Renamed" });
    await resetPassword(db, adminOne, admin.id);
    await deleteAdmin(db, adminOne, admin.id);
    expect(await emails()).not.toContain("r2@example.com");
  });

  it("stops an admin touching other admins or the SuperAdmin", async () => {
    await expect(createAdmin(db, adminOne, { email: "x@example.com", name: "Xx", role: "admin" })).rejects.toThrow(AdminError);
    for (const target of [adminTwo, superadmin]) {
      await expect(updateAdmin(db, adminOne, target.id, { email: "x@example.com", name: "Xx" })).rejects.toThrow(AdminError);
      await expect(resetPassword(db, adminOne, target.id)).rejects.toThrow(AdminError);
      await expect(deleteAdmin(db, adminOne, target.id)).rejects.toThrow(AdminError);
    }
    expect((await listAdmins(db, adminOne)).map(({ role }) => role).sort()).toEqual(["admin", "reviewer"]);
    expect((await listAdmins(db, adminOne)).map(({ id }) => id)).not.toContain(adminTwo.id);
  });

  it("stops a reviewer managing any account", async () => {
    await expect(createAdmin(db, reviewer, { email: "x@example.com", name: "Xx", role: "reviewer" })).rejects.toThrow(AdminError);
    for (const target of [adminOne, superadmin]) {
      await expect(deleteAdmin(db, reviewer, target.id)).rejects.toThrow(AdminError);
    }
    expect((await listAdmins(db, reviewer)).map(({ id }) => id)).toEqual([reviewer.id]);
  });

  it("never allows a second SuperAdmin, by role or by database", async () => {
    await expect(createAdmin(db, superadmin, { email: "x@example.com", name: "Xx", role: "superadmin" })).rejects.toThrow(AdminError);
    await expect(
      db.query(`INSERT INTO admins (email, name, role, password_hash) VALUES ('s2@example.com', 'S', 'superadmin', 'x')`),
    ).rejects.toThrow();
  });

  it("stops anyone deleting the SuperAdmin, or themselves", async () => {
    await expect(deleteAdmin(db, superadmin, superadmin.id)).rejects.toThrow(AdminError);
    await expect(deleteAdmin(db, adminOne, adminOne.id)).rejects.toThrow(AdminError);
    expect(canManage(superadmin, superadmin)).toBe(false);
  });

  it("signs a deleted account out at once", async () => {
    const token = await createSession(db, reviewer.id);
    await deleteAdmin(db, adminOne, reviewer.id);
    expect(await findSessionAdmin(db, token)).toBeNull();
  });

  it("refuses a duplicate email and bad input", async () => {
    await expect(createAdmin(db, superadmin, { email: "ONE@example.com", name: "Dup", role: "admin" })).rejects.toThrow(/already exists/);
    await expect(createAdmin(db, superadmin, { email: "nope", name: "Bad", role: "admin" })).rejects.toThrow(AdminError);
    await expect(deleteAdmin(db, superadmin, "not-a-uuid")).rejects.toThrow(AdminError);
  });

  it("stores only a hash of temporary passwords", async () => {
    const { temporaryPassword } = await createAdmin(db, superadmin, { email: "new@example.com", name: "New", role: "admin" });
    expect((await authenticate(db, { email: "new@example.com", password: temporaryPassword })).mustChangePassword).toBe(true);
    const [row] = await db.query<{ password_hash: string }>(`SELECT password_hash FROM admins WHERE email = 'new@example.com'`);
    expect(row.password_hash).not.toContain(temporaryPassword);
  });
});

describe("staff signing in with Google", () => {
  it("only matches an existing account, and retires a temporary password", async () => {
    expect(await authenticateWithGoogle(db, "stranger@example.com")).toBeNull();
    const { temporaryPassword } = await createAdmin(db, adminOne, { email: "g@example.com", name: "Goo", role: "reviewer" });
    const admin = await authenticateWithGoogle(db, "G@example.com");
    expect(admin?.role).toBe("reviewer");
    expect(admin?.mustChangePassword).toBe(false);
    await expect(authenticate(db, { email: "g@example.com", password: temporaryPassword })).rejects.toThrow(AdminError);
  });
});

describe("passwords", () => {
  it("changes your own, needs the current one, and signs out other devices", async () => {
    const here = await createSession(db, superadmin.id);
    const elsewhere = await createSession(db, superadmin.id);
    const next = "a-brand-new-long-password";
    await expect(changeOwnPassword(db, superadmin, here, { current: "wrong", next })).rejects.toThrow(AdminError);
    await expect(changeOwnPassword(db, superadmin, here, { current: SUPER_PASSWORD, next: "short" })).rejects.toThrow(AdminError);
    await changeOwnPassword(db, superadmin, here, { current: SUPER_PASSWORD, next });
    expect(await findSessionAdmin(db, here)).not.toBeNull();
    expect(await findSessionAdmin(db, elsewhere)).toBeNull();
    await expect(authenticate(db, { email: "super@example.com", password: SUPER_PASSWORD })).rejects.toThrow(AdminError);
    expect((await authenticate(db, { email: "super@example.com", password: next })).role).toBe("superadmin");
  });

  it("hashes with a fresh salt and rejects tampering", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password", a)).toBe(true);
    expect(await verifyPassword("other-password", a)).toBe(false);
    expect(await verifyPassword("same-password", "garbage")).toBe(false);
  });
});

describe("signing in", () => {
  it("gives the same error for an unknown email and a wrong password", async () => {
    const unknown = await authenticate(db, { email: "x@example.com", password: "y" }).catch((e) => e.message);
    const wrong = await authenticate(db, { email: "super@example.com", password: "y" }).catch((e) => e.message);
    expect(unknown).toBe(wrong);
  });

  it("locks an account after repeated failures, even with the right password", async () => {
    for (let i = 0; i < 10; i++) {
      await authenticate(db, { email: "super@example.com", password: "wrong" }).catch(() => {});
    }
    await expect(authenticate(db, { email: "super@example.com", password: SUPER_PASSWORD })).rejects.toThrow(AdminError);
    await db.query(`UPDATE admins SET locked_until = now() - interval '1 minute'`);
    expect((await authenticate(db, { email: "super@example.com", password: SUPER_PASSWORD })).role).toBe("superadmin");
  });

  it("resists SQL injection in the email", async () => {
    await expect(authenticate(db, { email: "' OR 1=1 --", password: "x" })).rejects.toThrow(AdminError);
    expect((await listAdmins(db, superadmin)).length).toBe(4);
  });
});

describe("sessions", () => {
  it("stores only a hash of the token, and ends on sign-out or expiry", async () => {
    const token = await createSession(db, superadmin.id);
    const [row] = await db.query<{ token_hash: string }>(`SELECT token_hash FROM admin_sessions`);
    expect(row.token_hash).not.toBe(token);

    await db.query(`UPDATE admin_sessions SET expires_at = now() - interval '1 second'`);
    expect(await findSessionAdmin(db, token)).toBeNull();

    const next = await createSession(db, superadmin.id);
    await deleteSession(db, next);
    expect(await findSessionAdmin(db, next)).toBeNull();
    expect(await findSessionAdmin(db, "not-a-token")).toBeNull();
  });
});
