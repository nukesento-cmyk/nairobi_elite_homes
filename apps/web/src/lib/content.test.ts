// @vitest-environment node
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminError, type Admin, type Db } from "@/lib/admin/accounts";
import {
  accessRequestStats,
  createAccessRequest,
  deleteAccessRequest,
  listAccessRequests,
  setAccessRequestStatus,
} from "@/lib/access-requests";
import { profileFromIdToken } from "@/lib/auth/google";
import { estimateBread, formatBread } from "@/lib/bread";
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
  listProperties,
  approveItem,
  countOffMarket,
  liveContent,
  publicProperties,
  publicProperty,
  publishedPost,
  publishedPosts,
  rejectItem,
  reviewQueue,
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
const post = { title: "Buying land", excerpt: "What to check first.", body: "Start with the title.", coverUrl: "", coverAlt: "", submit: true };
const live = async (input = property) => {
  const row = await createProperty(db, reviewer, input);
  await approveItem(db, staff("admin"), "property", row.id);
  return row;
};

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
  });

  it("stays off the site until approved", async () => {
    const row = await createProperty(db, reviewer, property);
    expect(await publicProperties(db)).toEqual([]);
    expect(await publicProperty(db, row.slug)).toBeNull();
    await approveItem(db, staff("admin"), "property", row.id);
    expect((await publicProperties(db)).length).toBe(1);
    const listing = await publicProperty(db, row.slug);
    expect(listing?.price).toEqual({ amount: 85000000, currency: "KES", period: "sale" });
    expect(listing?.features).toEqual(["Pool", "Garden"]);
    expect(listing?.isSample).toBe(false);
  });

  it("goes back for approval when edited, keeping its link", async () => {
    const row = await live();
    await updateProperty(db, reviewer, row.id, { ...property, title: "Renamed" });
    expect(await publicProperty(db, row.slug)).toBeNull();
    await approveItem(db, staff("superadmin"), "property", row.id);
    expect((await publicProperty(db, row.slug))?.title).toBe("Renamed");
  });

  it("reveals only type and area of a gated property, once approved", async () => {
    const gated = { ...property, status: "off_market", title: "SECRET", description: "SECRET" };
    const row = await createProperty(db, reviewer, gated);
    expect(await teaserProperties(db)).toEqual([]);
    await approveItem(db, staff("admin"), "property", row.id);
    expect(await publicProperties(db)).toEqual([]);
    expect(await publicProperty(db, row.slug)).toBeNull();
    const teasers = await teaserProperties(db);
    expect(Object.keys(teasers[0]).sort()).toEqual(["area", "id", "lqip", "vertical"]);
    expect(JSON.stringify(teasers)).not.toContain("SECRET");
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
    await live();
    await db.query(`DELETE FROM admins WHERE id = $1`, [reviewer.id]);
    expect((await publicProperties(db)).length).toBe(1);
  });
});

describe("approval", () => {
  it("lets admins and the SuperAdmin approve, and nobody else", async () => {
    const row = await createProperty(db, reviewer, property);
    await expect(approveItem(db, reviewer, "property", row.id)).rejects.toThrow(AdminError);
    await expect(reviewQueue(db, reviewer)).rejects.toThrow(AdminError);
    expect((await reviewQueue(db, staff("admin"))).properties.length).toBe(1);
    await approveItem(db, staff("superadmin"), "property", row.id);
    expect((await reviewQueue(db, staff("admin"))).properties).toEqual([]);
  });

  it("sends work back with a note, which is needed", async () => {
    const row = await createProperty(db, reviewer, property);
    await expect(rejectItem(db, staff("admin"), "property", row.id, "")).rejects.toThrow(AdminError);
    await rejectItem(db, staff("admin"), "property", row.id, "Photo is blurry");
    expect(await publicProperties(db)).toEqual([]);
    const [mine] = await listProperties(db, reviewer);
    expect(mine.reviewStatus).toBe("rejected");
    expect(mine.reviewNote).toBe("Photo is blurry");
    await updateProperty(db, reviewer, row.id, property);
    expect((await listProperties(db, reviewer))[0].reviewNote).toBeNull();
  });

  it("refuses an unknown kind, and work that isn't waiting", async () => {
    const row = await createProperty(db, reviewer, property);
    await expect(approveItem(db, staff("admin"), "admins; DROP TABLE admins", row.id)).rejects.toThrow(AdminError);
    await approveItem(db, staff("admin"), "property", row.id);
    await expect(approveItem(db, staff("admin"), "property", row.id)).rejects.toThrow(AdminError);
  });
});

describe("removing", () => {
  it("lets the SuperAdmin and reviewers remove live content, but not admins", async () => {
    const row = await live();
    await expect(deleteProperty(db, staff("admin"), row.id)).rejects.toThrow(AdminError);
    await expect(liveContent(db, staff("admin"))).rejects.toThrow(AdminError);
    expect((await liveContent(db, staff("superadmin"))).properties.length).toBe(1);
    await deleteProperty(db, staff("superadmin"), row.id);
    expect(await publicProperties(db)).toEqual([]);
    const second = await live();
    await deleteProperty(db, reviewer, second.id);
    expect(await publicProperties(db)).toEqual([]);
  });
});

describe("the off-market count", () => {
  it("counts only approved gated listings", async () => {
    expect(await countOffMarket(db)).toBe(0);
    await live();
    const gated = await createProperty(db, reviewer, { ...property, status: "off_market" });
    expect(await countOffMarket(db)).toBe(0);
    await approveItem(db, staff("admin"), "property", gated.id);
    expect(await countOffMarket(db)).toBe(1);
    await live({ ...property, status: "members_only" });
    expect(await countOffMarket(db)).toBe(2);
    await deleteProperty(db, reviewer, gated.id);
    expect(await countOffMarket(db)).toBe(1);
  });
});

describe("blog", () => {
  it("lets only reviewers write", async () => {
    await expect(createPost(db, staff("admin"), post)).rejects.toThrow(AdminError);
    await expect(createPost(db, staff("superadmin"), post)).rejects.toThrow(AdminError);
  });

  it("hides drafts and unapproved posts", async () => {
    const draft = await createPost(db, reviewer, { ...post, submit: false });
    expect(draft.reviewStatus).toBe("draft");
    expect((await reviewQueue(db, staff("admin"))).posts).toEqual([]);
    await updatePost(db, reviewer, draft.id, post);
    expect(await publishedPost(db, draft.slug)).toBeNull();
    expect((await reviewQueue(db, staff("admin"))).posts.length).toBe(1);
    await approveItem(db, staff("admin"), "post", draft.id);
    expect((await publishedPost(db, draft.slug))?.publishedAt).toBeTruthy();
    expect((await publishedPosts(db)).length).toBe(1);
  });

  it("stores text exactly, so markup is never treated as code", async () => {
    const created = await createPost(db, reviewer, { ...post, body: "<script>alert(1)</script> and text" });
    await approveItem(db, staff("admin"), "post", created.id);
    expect((await publishedPost(db, created.slug))?.body).toContain("<script>");
  });
});

describe("community link requests", () => {
  const request = { name: "Ann Buyer", phone: "0712 345 678", email: "", message: "" };

  it("logs a request, without needing an account", async () => {
    await createAccessRequest(db, request);
    const [row] = await listAccessRequests(db, staff("admin"));
    expect(row).toMatchObject({ name: "Ann Buyer", status: "pending", email: null, message: null });
  });

  it("lets admins and the SuperAdmin see and handle them, not reviewers", async () => {
    await createAccessRequest(db, request);
    await expect(listAccessRequests(db, reviewer)).rejects.toThrow(AdminError);
    const [row] = await listAccessRequests(db, staff("superadmin"));
    await expect(setAccessRequestStatus(db, reviewer, row.id, "link_sent")).rejects.toThrow(AdminError);
    await expect(deleteAccessRequest(db, reviewer, row.id)).rejects.toThrow(AdminError);
    await setAccessRequestStatus(db, staff("admin"), row.id, "link_sent");
    expect((await listAccessRequests(db, staff("admin")))[0].status).toBe("link_sent");
    await expect(setAccessRequestStatus(db, staff("admin"), row.id, "hacked")).rejects.toThrow(AdminError);
    await deleteAccessRequest(db, staff("admin"), row.id);
    expect(await listAccessRequests(db, staff("admin"))).toEqual([]);
  });

  it("doesn't pile up repeats while one is waiting", async () => {
    await createAccessRequest(db, request);
    await createAccessRequest(db, request);
    expect((await listAccessRequests(db, staff("admin"))).length).toBe(1);
  });

  it.each([
    ["no name", { name: "" }],
    ["a bad number", { phone: "not a number" }],
    ["a bad email", { email: "nope" }],
    ["a long message", { message: "x".repeat(501) }],
  ])("refuses %s", async (_, change) => {
    await expect(createAccessRequest(db, { ...request, ...change })).rejects.toThrow(AdminError);
  });
});

describe("request stats and bread", () => {
  const request = { email: "", message: "", name: "Ann Buyer" };

  it("counts every status, and fills 14 days including today", async () => {
    await createAccessRequest(db, { ...request, phone: "0700000001" });
    await createAccessRequest(db, { ...request, phone: "0700000002" });
    await createAccessRequest(db, { ...request, phone: "0700000003" });
    const rows = await listAccessRequests(db, staff("admin"));
    await setAccessRequestStatus(db, staff("admin"), rows[0].id, "link_sent");
    await setAccessRequestStatus(db, staff("admin"), rows[1].id, "declined");
    const stats = await accessRequestStats(db, staff("superadmin"));
    expect(stats).toMatchObject({ total: 3, pending: 1, linkSent: 1, declined: 1 });
    expect(stats.daily.length).toBe(14);
    expect(stats.daily.at(-1)?.count).toBe(3);
    expect(stats.daily.slice(0, -1).every(({ count }) => count === 0)).toBe(true);
    expect(estimateBread(stats, 2500)).toEqual({ potential: 5000, potentialPeople: 2, linkSent: 2500, price: 2500 });
  });

  it("keeps stats from reviewers, and gives no bread without a price", async () => {
    await expect(accessRequestStats(db, reviewer)).rejects.toThrow(AdminError);
    const stats = await accessRequestStats(db, staff("admin"));
    expect(stats.total).toBe(0);
    expect(estimateBread(stats, null)).toBeNull();
    expect(estimateBread(stats, 2500)?.potential).toBe(0);
    expect(formatBread(70000)).toBe("KES 70,000");
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
