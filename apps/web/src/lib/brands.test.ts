// @vitest-environment node
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AdminError,
  authenticate,
  createAdmin,
  deleteAdmin,
  listAdmins,
  resetPassword,
  updateAdmin,
  type Admin,
  type Db,
} from "@/lib/admin/accounts";
import { hashPassword } from "@/lib/admin/password";
import {
  accessRequestStats,
  createAccessRequest,
  deleteAccessRequest,
  listAccessRequests,
  setAccessRequestStatus,
} from "@/lib/access-requests";
import {
  authenticateBuyer,
  changeBuyerPassword,
  createBuyerSession,
  createUser,
  deleteUser,
  findSessionBuyer,
  listUsers,
  resetUserPassword,
  upsertBuyer,
} from "@/lib/buyers";
import {
  approveItem,
  createPost,
  createProperty,
  deletePost,
  deleteProperty,
  listPosts,
  listProperties,
  publicProperties,
  rejectItem,
  reviewQueue,
  updateProperty,
} from "@/lib/content";
import { createWhatsAppGroup, deleteWhatsAppGroup, listWhatsAppGroups } from "@/lib/whatsapp-groups";

import {
  accentContrast,
  brandIdForHost,
  brandIdForVisitor,
  createBrand,
  findBrandByKey,
  DEFAULT_BRAND_ID,
  listBrands,
  normalizeDomain,
  updateBrand,
  updateBrandSettings,
} from "./brands";

// Password hashing is deliberately slow, and each test starts a fresh database.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const property = {
  title: "Garden home", vertical: "residential", status: "public", area: "Karen", priceAmount: "85000000",
  priceCurrency: "KES", pricePeriod: "sale", beds: "", baths: "", acreage: "", sqm: "", titleStatus: "",
  zoning: "", description: "", features: "", heroUrl: "", heroAlt: "", galleryUrls: "", matterportId: "",
};
const post = { title: "Buying land", excerpt: "What to check first.", body: "Start with the title.", coverUrl: "", coverAlt: "", submit: true };
const group = { name: "Karen buyers", url: "https://chat.whatsapp.com/ABC123" };

let db: Db;
let superadmin: Admin;
let acmeId: string;
let acmeAdmin: Admin;
let acmeReviewer: Admin;
let homeAdmin: Admin;
let homeReviewer: Admin;

const accountFor = async (email: string): Promise<Admin> => {
  const [admin] = (await listAdmins(db, superadmin)).filter((row) => row.email === email);
  return admin;
};

beforeEach(async () => {
  const pg = new PGlite();
  await pg.exec(readFileSync("db/schema.sql", "utf8"));
  db = { query: async <Row>(text: string, params?: unknown[]) => (await pg.query<Row>(text, params)).rows };
  [superadmin] = await db.query<Admin>(
    `INSERT INTO admins (email, name, role, password_hash, must_change_password)
     VALUES ('super@example.com', 'Super', 'superadmin', $1, false)
     RETURNING id, email, name, role, brand_id AS "brandId", created_by AS "createdBy",
       must_change_password AS "mustChangePassword", created_at AS "createdAt"`,
    [await hashPassword("super-secret-password")],
  );
  const { brand } = await createBrand(db, superadmin, {
    name: "Acme Homes", domain: "https://www.Acme.example/about", adminName: "Ann", adminEmail: "ann@acme.example",
  });
  acmeId = brand.id;
  acmeAdmin = await accountFor("ann@acme.example");
  acmeReviewer = (await createAdmin(db, acmeAdmin, { email: "rev@acme.example", name: "Rev", role: "reviewer" })).admin;
  homeAdmin = (await createAdmin(db, superadmin, { email: "home@example.com", name: "Home", role: "admin", brandId: DEFAULT_BRAND_ID })).admin;
  homeReviewer = (await createAdmin(db, homeAdmin, { email: "rev@example.com", name: "Rev", role: "reviewer" })).admin;
});

describe("the database setup", () => {
  it("is safe to run again, and leaves existing brands alone", async () => {
    const pg = new PGlite();
    const schema = readFileSync("db/schema.sql", "utf8");
    await pg.exec(schema);
    await pg.exec(schema);
    await pg.exec(schema);
    const { rows } = await pg.query<{ id: string; slug: string }>(`SELECT id, slug FROM brands`);
    expect(rows).toEqual([{ id: DEFAULT_BRAND_ID, slug: "nairobi-elite-homes" }]);
  });
});

describe("creating a brand", () => {
  it("creates the brand and its first admin, who must choose a password", async () => {
    const { brand, temporaryPassword } = await createBrand(db, superadmin, {
      name: "No Domain Ltd", domain: "", adminName: "Bo", adminEmail: "bo@example.com",
    });
    expect(brand.domain).toBeNull();
    const admin = await authenticate(db, { email: "bo@example.com", password: temporaryPassword });
    expect(admin).toMatchObject({ role: "admin", brandId: brand.id, mustChangePassword: true, createdBy: superadmin.id });
  });

  it("is only for the SuperAdmin", async () => {
    const input = { name: "Other", domain: "", adminName: "Bo", adminEmail: "bo@example.com" };
    await expect(createBrand(db, acmeAdmin, input)).rejects.toThrow(AdminError);
    await expect(createBrand(db, acmeReviewer, input)).rejects.toThrow(AdminError);
    await expect(updateBrand(db, acmeAdmin, acmeId, { name: "Hacked", domain: "" })).rejects.toThrow(AdminError);
  });

  it("leaves nothing behind when the admin's email is taken", async () => {
    await expect(
      createBrand(db, superadmin, { name: "Dup", domain: "", adminName: "Bo", adminEmail: "ann@acme.example" }),
    ).rejects.toThrow(/already in use/);
    expect((await listBrands(db, superadmin)).map(({ name }) => name)).not.toContain("Dup");
  });

  it("refuses a repeated name or domain", async () => {
    const admin = { adminName: "Bo", adminEmail: "bo@example.com" };
    await expect(createBrand(db, superadmin, { name: "ACME HOMES", domain: "", ...admin })).rejects.toThrow(/already in use/);
    await expect(createBrand(db, superadmin, { name: "New", domain: "acme.example", ...admin })).rejects.toThrow(/already in use/);
  });

  it("keeps the SuperAdmin outside brands, and everyone else inside one, in the database", async () => {
    await expect(db.query(`UPDATE admins SET brand_id = NULL WHERE id = $1`, [acmeAdmin.id])).rejects.toThrow();
    await expect(db.query(`UPDATE admins SET brand_id = $1 WHERE id = $2`, [acmeId, superadmin.id])).rejects.toThrow();
  });
});

describe("domains", () => {
  it.each([
    ["example.com", "example.com"],
    ["https://www.Example.com/about?x=1", "example.com"],
    ["homes.example.co.ke", "homes.example.co.ke"],
    ["  ", null],
  ])("reads %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each(["not a domain", "localhost", "exa_mple.com", "site.vercel.app", "javascript:alert(1)"])("refuses %s", (input) => {
    expect(() => normalizeDomain(input)).toThrow(AdminError);
  });

  it("maps a visitor's address to a brand, and anything else to the original", async () => {
    expect(await brandIdForHost(db, "acme.example")).toBe(acmeId);
    expect(await brandIdForHost(db, "WWW.acme.example:443")).toBe(acmeId);
    expect(await brandIdForHost(db, "nairobi-elite-homes.vercel.app")).toBe(DEFAULT_BRAND_ID);
    expect(await brandIdForHost(db, null)).toBe(DEFAULT_BRAND_ID);
  });
});

describe("a brand's site", () => {
  const settings = { logoUrl: "", tagline: "Homes that last", about: "", accentColor: "#44ccaa", contactEmail: "", contactPhone: "", whatsappPhone: "0712 345 678" };

  it("gets an address from its name, which survives a rename", async () => {
    const brand = await findBrandByKey(db, "acme-homes");
    expect(brand?.id).toBe(acmeId);
    await updateBrand(db, superadmin, acmeId, { name: "Renamed", domain: "acme.example" });
    expect((await findBrandByKey(db, "acme-homes"))?.name).toBe("Renamed");
    expect((await findBrandByKey(db, "acme.example"))?.id).toBe(acmeId);
    expect(await findBrandByKey(db, "nobody")).toBeNull();
  });

  it("can be changed by its own admins and the SuperAdmin only", async () => {
    await updateBrandSettings(db, acmeAdmin, acmeId, settings);
    await updateBrandSettings(db, superadmin, acmeId, { ...settings, tagline: "By super" });
    expect((await findBrandByKey(db, "acme-homes"))).toMatchObject({ tagline: "By super", accentColor: "#44ccaa", whatsappPhone: "0712 345 678" });
    await expect(updateBrandSettings(db, homeAdmin, acmeId, settings)).rejects.toThrow(AdminError);
    await expect(updateBrandSettings(db, acmeReviewer, acmeId, settings)).rejects.toThrow(AdminError);
  });

  it("isn't how the main site is changed", async () => {
    await expect(updateBrandSettings(db, superadmin, DEFAULT_BRAND_ID, settings)).rejects.toThrow(AdminError);
  });

  it("clears anything left blank", async () => {
    await updateBrandSettings(db, acmeAdmin, acmeId, settings);
    await updateBrandSettings(db, acmeAdmin, acmeId, { ...settings, tagline: "", accentColor: "" });
    expect(await findBrandByKey(db, "acme-homes")).toMatchObject({ tagline: null, accentColor: null });
  });

  it.each([
    ["an insecure logo", { logoUrl: "http://example.com/a.png" }],
    ["a script as a logo", { logoUrl: "javascript:alert(1)" }],
    ["a colour that isn't one", { accentColor: "red;background:url(x)" }],
    ["a colour too dark to read", { accentColor: "#101010" }],
    ["a bad email", { contactEmail: "nope" }],
    ["a bad WhatsApp number", { whatsappPhone: "call me" }],
  ])("refuses %s", async (_, change) => {
    await expect(updateBrandSettings(db, acmeAdmin, acmeId, { ...settings, ...change })).rejects.toThrow(AdminError);
  });

  it("measures contrast against the page", () => {
    expect(accentContrast("#ffffff")).toBeGreaterThan(15);
    expect(accentContrast("#0e1a14")).toBeCloseTo(1);
  });

  it("files visitors under the brand whose site they're on", async () => {
    expect(await brandIdForVisitor(db, "/b/acme-homes", "main.example")).toBe(acmeId);
    expect(await brandIdForVisitor(db, "", "acme.example")).toBe(acmeId);
    expect(await brandIdForVisitor(db, "", "main.example")).toBe(DEFAULT_BRAND_ID);
    expect(await brandIdForVisitor(db, "/b/nobody", "main.example")).toBe(DEFAULT_BRAND_ID);
  });
});

describe("staff within a brand", () => {
  it("puts an admin's new accounts in their own brand, whatever the request says", async () => {
    const { admin } = await createAdmin(db, acmeAdmin, { email: "x@acme.example", name: "Xx", role: "admin", brandId: DEFAULT_BRAND_ID });
    expect(admin.brandId).toBe(acmeId);
    expect(admin.createdBy).toBe(acmeAdmin.id);
  });

  it("makes the SuperAdmin choose a real brand", async () => {
    const base = { email: "x@example.com", name: "Xx", role: "admin" };
    await expect(createAdmin(db, superadmin, base)).rejects.toThrow(/Choose a brand/);
    await expect(createAdmin(db, superadmin, { ...base, brandId: "00000000-0000-4000-8000-00000000dead" })).rejects.toThrow(/Choose a brand/);
  });

  it("shows admins their brand only", async () => {
    const emails = (await listAdmins(db, acmeAdmin)).map(({ email }) => email).sort();
    expect(emails).toEqual(["ann@acme.example", "rev@acme.example"]);
    expect((await listBrands(db, acmeAdmin)).map(({ id }) => id)).toEqual([acmeId]);
  });

  it("stops an admin touching another brand's staff", async () => {
    for (const target of [homeAdmin, homeReviewer]) {
      await expect(updateAdmin(db, acmeAdmin, target.id, { email: "x@example.com", name: "Xx" })).rejects.toThrow(AdminError);
      await expect(resetPassword(db, acmeAdmin, target.id)).rejects.toThrow(AdminError);
      await expect(deleteAdmin(db, acmeAdmin, target.id)).rejects.toThrow(AdminError);
    }
  });

  it("lets the SuperAdmin manage any brand's staff", async () => {
    await resetPassword(db, superadmin, acmeReviewer.id);
    await deleteAdmin(db, superadmin, acmeReviewer.id);
  });
});

describe("content stays in its brand", () => {
  it("keeps one brand's properties away from another's staff", async () => {
    const row = await createProperty(db, acmeReviewer, property);
    expect((await listProperties(db, homeReviewer))).toEqual([]);
    expect((await reviewQueue(db, homeAdmin)).properties).toEqual([]);
    await expect(updateProperty(db, homeReviewer, row.id, property)).rejects.toThrow(AdminError);
    await expect(approveItem(db, homeAdmin, "property", row.id)).rejects.toThrow(AdminError);
    await expect(rejectItem(db, homeAdmin, "property", row.id, "Not yours")).rejects.toThrow(AdminError);
    await deleteProperty(db, homeReviewer, row.id);
    expect((await listProperties(db, acmeReviewer)).length).toBe(1);
  });

  it("keeps blogs apart too", async () => {
    const row = await createPost(db, acmeReviewer, post);
    expect(await listPosts(db, homeReviewer)).toEqual([]);
    expect((await reviewQueue(db, homeAdmin)).posts).toEqual([]);
    await expect(approveItem(db, homeAdmin, "post", row.id)).rejects.toThrow(AdminError);
    await deletePost(db, homeReviewer, row.id);
    expect((await listPosts(db, acmeReviewer)).length).toBe(1);
  });

  it("lets the SuperAdmin see and approve across brands", async () => {
    const row = await createProperty(db, acmeReviewer, property);
    expect((await reviewQueue(db, superadmin)).properties.length).toBe(1);
    await approveItem(db, superadmin, "property", row.id);
  });

  it("keeps another brand's approved properties off the original brand's public site", async () => {
    await createProperty(db, acmeAdmin, property);
    expect(await publicProperties(db)).toEqual([]);
    expect((await publicProperties(db, acmeId)).length).toBe(1);
  });

  it("sends requests to the right brand's admins", async () => {
    const request = { name: "Ann Buyer", phone: "0712345678", email: "", message: "" };
    await createAccessRequest(db, request, acmeId);
    await createAccessRequest(db, request, DEFAULT_BRAND_ID);
    const [mine] = await listAccessRequests(db, acmeAdmin);
    expect(mine.brandId).toBe(acmeId);
    expect((await listAccessRequests(db, homeAdmin)).length).toBe(1);
    expect((await listAccessRequests(db, superadmin)).length).toBe(2);
    expect((await accessRequestStats(db, acmeAdmin)).total).toBe(1);
    expect((await accessRequestStats(db, acmeAdmin)).daily.at(-1)?.count).toBe(1);
    await expect(setAccessRequestStatus(db, homeAdmin, mine.id, "declined")).rejects.toThrow(AdminError);
    await deleteAccessRequest(db, homeAdmin, mine.id);
    expect((await listAccessRequests(db, acmeAdmin)).length).toBe(1);
  });
});

describe("WhatsApp groups", () => {
  it("belong to a brand, and only admins see them", async () => {
    await createWhatsAppGroup(db, acmeAdmin, group);
    const [row] = await listWhatsAppGroups(db, acmeAdmin);
    expect(row.brandId).toBe(acmeId);
    expect(await listWhatsAppGroups(db, homeAdmin)).toEqual([]);
    await expect(listWhatsAppGroups(db, acmeReviewer)).rejects.toThrow(AdminError);
    await expect(createWhatsAppGroup(db, acmeReviewer, group)).rejects.toThrow(AdminError);
    await expect(deleteWhatsAppGroup(db, homeAdmin, row.id)).rejects.toThrow(AdminError);
    await deleteWhatsAppGroup(db, acmeAdmin, row.id);
    expect(await listWhatsAppGroups(db, acmeAdmin)).toEqual([]);
  });

  it("makes the SuperAdmin choose a brand", async () => {
    await expect(createWhatsAppGroup(db, superadmin, group)).rejects.toThrow(/Choose a brand/);
    await createWhatsAppGroup(db, superadmin, { ...group, brandId: acmeId });
    expect((await listWhatsAppGroups(db, acmeAdmin)).length).toBe(1);
  });

  it.each(["https://example.com/x", "http://chat.whatsapp.com/ABC", 'https://chat.whatsapp.com/a"b', ""])("refuses the link %s", async (url) => {
    await expect(createWhatsAppGroup(db, acmeAdmin, { ...group, url })).rejects.toThrow(AdminError);
  });

  it("refuses a repeat", async () => {
    await createWhatsAppGroup(db, acmeAdmin, group);
    await expect(createWhatsAppGroup(db, acmeAdmin, group)).rejects.toThrow(/already/);
  });
});

describe("users", () => {
  const next = "a-brand-new-long-password";

  it("can be added by admins and reviewers, in their own brand", async () => {
    for (const actor of [acmeAdmin, acmeReviewer]) {
      const { user } = await createUser(db, actor, { email: `${actor.role}@u.example`, name: "User", brandId: DEFAULT_BRAND_ID });
      expect(user.brandId).toBe(acmeId);
    }
    expect((await listUsers(db, acmeAdmin)).length).toBe(2);
    expect(await listUsers(db, homeAdmin)).toEqual([]);
    expect((await listUsers(db, superadmin)).length).toBe(2);
  });

  it("makes the SuperAdmin choose a brand", async () => {
    await expect(createUser(db, superadmin, { email: "u@example.com", name: "User" })).rejects.toThrow(/Choose a brand/);
  });

  it("stops another brand's staff resetting or deleting them", async () => {
    const { user } = await createUser(db, acmeAdmin, { email: "u@example.com", name: "User" });
    await expect(resetUserPassword(db, homeAdmin, user.id)).rejects.toThrow(AdminError);
    await expect(deleteUser(db, homeReviewer, user.id)).rejects.toThrow(AdminError);
    expect((await listUsers(db, acmeAdmin)).length).toBe(1);
  });

  it("signs in with a temporary password that must be replaced", async () => {
    const { temporaryPassword } = await createUser(db, acmeAdmin, { email: "U@example.com", name: "User" });
    const user = await authenticateBuyer(db, { email: "u@example.com", password: temporaryPassword });
    expect(user.mustChangePassword).toBe(true);
    const here = await createBuyerSession(db, user.id);
    const elsewhere = await createBuyerSession(db, user.id);
    await expect(changeBuyerPassword(db, user, here, { current: "wrong", next })).rejects.toThrow(AdminError);
    await expect(changeBuyerPassword(db, user, here, { current: temporaryPassword, next: "short" })).rejects.toThrow(AdminError);
    await changeBuyerPassword(db, user, here, { current: temporaryPassword, next });
    expect((await findSessionBuyer(db, here))?.mustChangePassword).toBe(false);
    expect(await findSessionBuyer(db, elsewhere)).toBeNull();
    await expect(authenticateBuyer(db, { email: "u@example.com", password: temporaryPassword })).rejects.toThrow(AdminError);
    expect((await authenticateBuyer(db, { email: "u@example.com", password: next })).id).toBe(user.id);
  });

  it("gives the same error for an unknown email, a wrong password and a Google-only account", async () => {
    await createUser(db, acmeAdmin, { email: "u@example.com", name: "User" });
    await upsertBuyer(db, { sub: "g-1", email: "g@example.com", name: "Goo" }, acmeId);
    const message = (input: { email: string; password: string }) => authenticateBuyer(db, input).catch((e) => e.message);
    const wrong = await message({ email: "u@example.com", password: "x" });
    expect(await message({ email: "nobody@example.com", password: "x" })).toBe(wrong);
    expect(await message({ email: "g@example.com", password: "x" })).toBe(wrong);
  });

  it("locks after repeated failures, and a staff reset gets them back in", async () => {
    const { user, temporaryPassword } = await createUser(db, acmeAdmin, { email: "u@example.com", name: "User" });
    for (let i = 0; i < 10; i++) await authenticateBuyer(db, { email: "u@example.com", password: "wrong" }).catch(() => {});
    await expect(authenticateBuyer(db, { email: "u@example.com", password: temporaryPassword })).rejects.toThrow(AdminError);
    const reset = await resetUserPassword(db, acmeAdmin, user.id);
    expect((await authenticateBuyer(db, { email: "u@example.com", password: reset })).id).toBe(user.id);
  });

  it("signs out at once when reset or deleted", async () => {
    const { user } = await createUser(db, acmeAdmin, { email: "u@example.com", name: "User" });
    const first = await createBuyerSession(db, user.id);
    await resetUserPassword(db, acmeAdmin, user.id);
    expect(await findSessionBuyer(db, first)).toBeNull();
    const second = await createBuyerSession(db, user.id);
    await deleteUser(db, acmeAdmin, user.id);
    expect(await findSessionBuyer(db, second)).toBeNull();
  });
});

describe("Google and accounts staff created", () => {
  const profile = { sub: "g-1", email: "U@example.com", name: "From Google" };

  it("links to the existing account, keeps its brand, and retires a temporary password", async () => {
    const { user, temporaryPassword } = await createUser(db, acmeAdmin, { email: "u@example.com", name: "User" });
    const signedIn = await upsertBuyer(db, profile, DEFAULT_BRAND_ID);
    expect(signedIn).toMatchObject({ id: user.id, brandId: acmeId, mustChangePassword: false });
    await expect(authenticateBuyer(db, { email: "u@example.com", password: temporaryPassword })).rejects.toThrow(AdminError);
  });

  it("keeps a password the person chose themselves", async () => {
    const { user, temporaryPassword } = await createUser(db, acmeAdmin, { email: "u@example.com", name: "User" });
    const next = "a-brand-new-long-password";
    await changeBuyerPassword(db, user, await createBuyerSession(db, user.id), { current: temporaryPassword, next });
    await upsertBuyer(db, profile, DEFAULT_BRAND_ID);
    expect((await authenticateBuyer(db, { email: "u@example.com", password: next })).id).toBe(user.id);
  });

  it("puts a new person in the brand they signed up on", async () => {
    expect((await upsertBuyer(db, profile, acmeId))?.brandId).toBe(acmeId);
  });

  it("refuses an email already linked to a different Google account", async () => {
    await upsertBuyer(db, profile, acmeId);
    expect(await upsertBuyer(db, { ...profile, sub: "g-2" }, acmeId)).toBeNull();
  });

  it("refuses a duplicate email when staff add one", async () => {
    await upsertBuyer(db, profile, DEFAULT_BRAND_ID);
    await expect(createUser(db, acmeAdmin, { email: "u@example.com", name: "User" })).rejects.toThrow(/already exists/);
  });
});
