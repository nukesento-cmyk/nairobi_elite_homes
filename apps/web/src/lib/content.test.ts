// @vitest-environment node
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminError, type Admin, type Db } from "@/lib/admin/accounts";
import { profileFromIdToken } from "@/lib/auth/google";
import {
  createBuyerSession,
  deleteBuyerSession,
  findSessionBuyer,
  upsertBuyer,
} from "@/lib/buyers";

import {
  createPost,
  createProperty,
  deleteProperty,
  publicProperties,
  publicProperty,
  publishedPost,
  publishedPosts,
  teaserProperties,
  updatePost,
  updateProperty,
} from "./content";

let db: Db;
let reviewer: Admin;
const staff = (role: Admin["role"]): Admin => ({ ...reviewer, role });

const property = {
  title: "Garden home",
  vertical: "residential",
  status: "public",
  area: "Karen",
  priceAmount: "85000000",
  priceCurrency: "KES",
  pricePeriod: "sale",
  beds: "5",
  baths: "",
  acreage: "",
  sqm: "420",
  titleStatus: "freehold",
  zoning: "",
  description: "A home.",
  features: "Pool\n\n Garden ",
  heroUrl: "https://example.com/a.jpg",
  heroAlt: "",
  galleryUrls: "https://example.com/b.jpg",
  matterportId: "",
};
const post = { title: "Buying land", excerpt: "What to check first.", body: "Start with the title.", coverUrl: "", coverAlt: "", published: true };

// Password hashing is deliberately slow, and each test starts a fresh database.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

beforeEach(async () => {
  const pg = new PGlite();
  await pg.exec(readFileSync("db/schema.sql", "utf8"));
  db = { query: async <Row>(text: string, params?: unknown[]) => (await pg.query<Row>(text, params)).rows };
  [reviewer] = await db.query<Admin>(
    `INSERT INTO admins (email, name, role, password_hash) VALUES ('r@example.com', 'Rev', 'reviewer', 'x')
     RETURNING id, email, name, role, must_change_password AS "mustChangePassword", created_at AS "createdAt"`,
  );
});

describe("properties", () => {
  it("lets only reviewers add them", async () => {
    await createProperty(db, reviewer, property);
    for (const role of ["admin", "superadmin"] as const) {
      await expect(createProperty(db, staff(role), property)).rejects.toThrow(AdminError);
    }
    expect((await publicProperties(db)).length).toBe(1);
  });

  it("publishes a public property in the site's listing shape", async () => {
    const { slug } = await createProperty(db, reviewer, property);
    const listing = await publicProperty(db, slug);
    expect(listing?.price).toEqual({ amount: 85000000, currency: "KES", period: "sale" });
    expect(listing?.specs.beds).toBe(5);
    expect(listing?.features).toEqual(["Pool", "Garden"]);
    expect(listing?.hero?.url).toBe("https://example.com/a.jpg");
    expect(listing?.isSample).toBe(false);
  });

  it("reveals only type and area of a gated property", async () => {
    const gated = await createProperty(db, reviewer, { ...property, status: "off_market", title: "SECRET", description: "SECRET" });
    expect(await publicProperties(db)).toEqual([]);
    expect(await publicProperty(db, gated.slug)).toBeNull();
    const teasers = await teaserProperties(db);
    expect(teasers.length).toBe(1);
    expect(Object.keys(teasers[0]).sort()).toEqual(["area", "id", "lqip", "vertical"]);
    expect(JSON.stringify(teasers)).not.toContain("SECRET");
  });

  it("edits, keeps the link, and deletes", async () => {
    const row = await createProperty(db, reviewer, property);
    await updateProperty(db, reviewer, row.id, { ...property, title: "Renamed" });
    expect((await publicProperty(db, row.slug))?.title).toBe("Renamed");
    await deleteProperty(db, reviewer, row.id);
    expect(await publicProperty(db, row.slug)).toBeNull();
  });

  it.each([
    ["no title", { title: "" }],
    ["a bad price", { priceAmount: "free" }],
    ["an unknown area", { area: "Atlantis" }],
    ["an unsafe image link", { heroUrl: "javascript:alert(1)" }],
    ["a plain http image", { heroUrl: "http://example.com/a.jpg" }],
    ["a bad gallery link", { galleryUrls: "javascript:alert(1)" }],
    ["a malformed Matterport ID", { matterportId: 'x"><script>' }],
  ])("refuses %s", async (_, change) => {
    await expect(createProperty(db, reviewer, { ...property, ...change })).rejects.toThrow(AdminError);
  });

  it("keeps a property when the reviewer who added it is deleted", async () => {
    await createProperty(db, reviewer, property);
    await db.query(`DELETE FROM admins WHERE id = $1`, [reviewer.id]);
    expect((await publicProperties(db)).length).toBe(1);
  });
});

describe("blog", () => {
  it("lets only reviewers write", async () => {
    await expect(createPost(db, staff("admin"), post)).rejects.toThrow(AdminError);
    await expect(createPost(db, staff("superadmin"), post)).rejects.toThrow(AdminError);
  });

  it("hides drafts, and shows a post once published", async () => {
    const draft = await createPost(db, reviewer, { ...post, published: false });
    expect(await publishedPosts(db)).toEqual([]);
    expect(await publishedPost(db, draft.slug)).toBeNull();
    await updatePost(db, reviewer, draft.id, post);
    expect((await publishedPost(db, draft.slug))?.publishedAt).toBeTruthy();
  });

  it("stores text exactly, so markup is never treated as code", async () => {
    const created = await createPost(db, reviewer, { ...post, body: "<script>alert(1)</script> and text" });
    expect((await publishedPost(db, created.slug))?.body).toContain("<script>");
  });
});

describe("buyers", () => {
  const profile = { sub: "google-1", email: "Buyer@Example.com", name: "Buyer" };

  it("creates a buyer once, and keeps them on later sign-ins", async () => {
    const first = await upsertBuyer(db, profile);
    const again = await upsertBuyer(db, { ...profile, name: "New Name" });
    expect(again.id).toBe(first.id);
    expect(again.name).toBe("New Name");
    expect(again.email).toBe("buyer@example.com");
  });

  it("holds sessions apart from staff, and ends them on sign-out", async () => {
    const buyer = await upsertBuyer(db, profile);
    const token = await createBuyerSession(db, buyer.id);
    expect((await findSessionBuyer(db, token))?.id).toBe(buyer.id);
    const staffSessions = await db.query(`SELECT 1 FROM admin_sessions`);
    expect(staffSessions).toEqual([]);
    await deleteBuyerSession(db, token);
    expect(await findSessionBuyer(db, token)).toBeNull();
  });
});

describe("Google sign-in tokens", () => {
  const expected = { clientId: "client", nonce: "nonce", now: 1000 };
  const claims = { iss: "https://accounts.google.com", aud: "client", exp: 2000, nonce: "nonce", email_verified: true, sub: "1", email: "a@example.com", name: "A" };
  const token = (body: object) => `x.${Buffer.from(JSON.stringify(body)).toString("base64url")}.y`;

  it("accepts a valid token", () => {
    expect(profileFromIdToken(token(claims), expected)).toEqual({ sub: "1", email: "a@example.com", name: "A" });
  });

  it.each([
    ["another app", { aud: "other" }],
    ["an old attempt", { nonce: "old" }],
    ["an expired token", { exp: 500 }],
    ["an unverified email", { email_verified: false }],
    ["another issuer", { iss: "https://evil.example" }],
  ])("refuses %s", (_, change) => {
    expect(profileFromIdToken(token({ ...claims, ...change }), expected)).toBeNull();
  });

  it("refuses garbage", () => {
    expect(profileFromIdToken("not-a-token", expected)).toBeNull();
  });
});
