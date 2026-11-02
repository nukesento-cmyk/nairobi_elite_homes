// @vitest-environment node
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  AdminError,
  authenticate,
  canDeleteAdmin,
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

beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(SCHEMA);
  db = { query: async <Row>(text: string, params?: unknown[]) => (await pg.query<Row>(text, params)).rows };

  await db.query(
    `INSERT INTO admins (email, name, role, password_hash, must_change_password)
     VALUES ('super@example.com', 'Super', 'superadmin', $1, false)`,
    [await hashPassword(SUPER_PASSWORD)],
  );
  superadmin = (await listAdmins(db))[0];
  adminOne = (await createAdmin(db, { email: "One@Example.com", name: "One" })).admin;
  adminTwo = (await createAdmin(db, { email: "two@example.com", name: "Two" })).admin;
});

const emails = async () => (await listAdmins(db)).map((admin) => admin.email);

describe("deleting", () => {
  it("lets the SuperAdmin delete an admin", async () => {
    await deleteAdmin(db, superadmin, adminOne.id);
    expect(await emails()).toEqual(["super@example.com", "two@example.com"]);
  });

  it("stops an admin deleting another admin", async () => {
    await expect(deleteAdmin(db, adminOne, adminTwo.id)).rejects.toThrow(AdminError);
    expect(await emails()).toContain("two@example.com");
  });

  it("stops an admin deleting themselves", async () => {
    await expect(deleteAdmin(db, adminOne, adminOne.id)).rejects.toThrow(AdminError);
    expect(await emails()).toContain("one@example.com");
  });

  it("stops anyone deleting the SuperAdmin, including the SuperAdmin", async () => {
    await expect(deleteAdmin(db, adminOne, superadmin.id)).rejects.toThrow(AdminError);
    await expect(deleteAdmin(db, superadmin, superadmin.id)).rejects.toThrow(AdminError);
    expect(canDeleteAdmin(superadmin, superadmin)).toBe(false);
    expect(await emails()).toContain("super@example.com");
  });

  it("signs a deleted admin out at once", async () => {
    const token = await createSession(db, adminOne.id);
    expect(await findSessionAdmin(db, token)).not.toBeNull();
    await deleteAdmin(db, superadmin, adminOne.id);
    expect(await findSessionAdmin(db, token)).toBeNull();
  });

  it("reports a missing or malformed id", async () => {
    await expect(deleteAdmin(db, superadmin, "not-a-uuid")).rejects.toThrow(AdminError);
    await expect(deleteAdmin(db, superadmin, crypto.randomUUID())).rejects.toThrow(AdminError);
  });
});

describe("creating and editing", () => {
  it("only ever creates the admin role, and stores a lowercase email", async () => {
    expect(adminOne.role).toBe("admin");
    expect(adminOne.email).toBe("one@example.com");
    expect(adminOne.mustChangePassword).toBe(true);
  });

  it("returns a temporary password that signs in, and stores only a hash", async () => {
    const { temporaryPassword } = await createAdmin(db, { email: "new@example.com", name: "New" });
    const admin = await authenticate(db, { email: "new@example.com", password: temporaryPassword });
    expect(admin.mustChangePassword).toBe(true);
    const [row] = await db.query<{ password_hash: string }>(
      `SELECT password_hash FROM admins WHERE email = 'new@example.com'`,
    );
    expect(row.password_hash).not.toContain(temporaryPassword);
  });

  it("refuses a duplicate email and bad input", async () => {
    await expect(createAdmin(db, { email: "ONE@example.com", name: "Dup" })).rejects.toThrow(/already exists/);
    await expect(createAdmin(db, { email: "nope", name: "Bad" })).rejects.toThrow(AdminError);
    await expect(createAdmin(db, { email: "a@example.com", name: "" })).rejects.toThrow(AdminError);
    await expect(updateAdmin(db, adminOne, adminTwo.id, { email: "ONE@example.com", name: "x y" })).rejects.toThrow(/already exists/);
  });

  it("lets admins edit admins, but not the SuperAdmin", async () => {
    await updateAdmin(db, adminOne, adminTwo.id, { email: "two@example.com", name: "Renamed" });
    expect((await listAdmins(db)).find(({ id }) => id === adminTwo.id)?.name).toBe("Renamed");
    await expect(
      updateAdmin(db, adminOne, superadmin.id, { email: "hacked@example.com", name: "Hacked" }),
    ).rejects.toThrow(AdminError);
    expect(await emails()).toContain("super@example.com");
  });

  it("allows one SuperAdmin only, enforced by the database", async () => {
    await expect(
      db.query(`INSERT INTO admins (email, name, role, password_hash) VALUES ('s2@example.com', 'S', 'superadmin', 'x')`),
    ).rejects.toThrow();
  });
});

describe("passwords", () => {
  it("resets only for the SuperAdmin, and signs the admin out", async () => {
    const token = await createSession(db, adminOne.id);
    await expect(resetPassword(db, adminTwo, adminOne.id)).rejects.toThrow(AdminError);
    await expect(resetPassword(db, adminOne, superadmin.id)).rejects.toThrow(AdminError);
    const password = await resetPassword(db, superadmin, adminOne.id);
    expect(await findSessionAdmin(db, token)).toBeNull();
    expect((await authenticate(db, { email: "one@example.com", password })).mustChangePassword).toBe(true);
  });

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
    expect((await listAdmins(db)).length).toBe(3);
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
