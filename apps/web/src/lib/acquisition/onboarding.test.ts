// @vitest-environment node
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Admin, Db } from "@/lib/admin/accounts";
import { approveItem, publicProperties } from "@/lib/content";

import { logCall } from "./calls";
import { runDailyJob } from "./daily-job";
import { approveLead } from "./dashboard";
import {
  confirmStep, decryptDocument, encryptDocument, failOnboarding, issueUploadLink, listOnboarding, purgeExpiredDocuments, readDocument, removeDocument,
  probeDocumentStore, saveDocumentAsStaff, saveDocumentFromLink, sniffDocumentType, startOnboarding, submitForApproval, verifyDocument, type DocumentStore,
} from "./onboarding";
import { documentStoreFromEnv, missingDocumentSettings } from "./document-store";
import { ownerSubmissionSchema } from "./owner-form";
import { saveOwnerSubmission } from "./owner-submission";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const { oidc, blob } = vi.hoisted(() => ({ oidc: vi.fn(), blob: { put: vi.fn(), get: vi.fn(), del: vi.fn() } }));
vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: oidc }));
vi.mock("@vercel/blob", () => blob);

const BRAND = "00000000-0000-4000-8000-000000000001";
const KEY = Buffer.alloc(32, 7).toString("base64");
const PDF = Buffer.from("%PDF-1.7 my national id number 12345678");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("rest")]);
const LISTING = { title: "Garden home", vertical: "residential", status: "public", area: "Karen", beds: "4", baths: "", acreage: "", sqm: "", titleStatus: "freehold", zoning: "", description: "Lovely.", features: "Pool", heroUrl: "https://photos.example/a.jpg", heroAlt: "Front", galleryUrls: "", matterportId: "" };
const TERMS = { amount: "85000000", currency: "KES", period: "sale", terms: "Sole agency for 90 days." };

let pg: PGlite;
let db: Db;
let me: Admin;
let colleague: Admin;
let files: Map<string, Buffer>;
let store: DocumentStore;
const deps = () => ({ db, store, key: KEY });
const one = async <Row,>(text: string, params: unknown[] = []) => (await db.query<Row>(text, params))[0];

const interestedLead = async () => {
  const input = ownerSubmissionSchema.parse({ name: "Jane Doe", phone: "0712 345 678", role: "owner", area: "Karen", propertyType: "house", intent: "sale", consent: true });
  const { id } = await saveOwnerSubmission({ db, brandId: BRAND, hashKey: "k" }, input) as { id: string };
  await approveLead(db, me, BRAND, id);
  await logCall(db, me, BRAND, id, { outcome: "interested", notes: "", optOutLineRead: true, nextFollowUp: "" }, "2026-11-05");
  return id;
};
const started = async () => { const prospect = await interestedLead(); return { prospect, id: await startOnboarding(db, me, BRAND, prospect) }; };
const upload = async (id: string, docType: string, bytes = PDF) => {
  const token = await issueUploadLink(db, me, BRAND, id);
  await saveDocumentFromLink(deps(), token, docType, bytes);
  const [{ id: doc }] = await db.query<{ id: string }>(`SELECT id FROM acq_onboarding_documents WHERE onboarding_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]);
  return doc;
};
const checked = async (id: string, docType: string) => verifyDocument(db, me, BRAND, await upload(id, docType));
const readyToSubmit = async () => {
  const { prospect, id } = await started();
  await checked(id, "identity"); await confirmStep(db, me, BRAND, id, "identity");
  await checked(id, "ownership"); await confirmStep(db, me, BRAND, id, "ownership");
  await confirmStep(db, me, BRAND, id, "availability");
  await confirmStep(db, me, BRAND, id, "terms", TERMS);
  await checked(id, "marketing_authority"); await confirmStep(db, me, BRAND, id, "authority");
  return { prospect, id };
};

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8"));
  db = { query: async <Row,>(text: string, params: unknown[] = []) => (await pg.query<Row>(text, params)).rows };
  const superadmin = await one<{ id: string }>(`INSERT INTO admins (email, name, role, password_hash) VALUES ('s@example.com', 'S', 'superadmin', 'x') RETURNING id`);
  me = { id: superadmin.id, role: "superadmin", brandId: null } as Admin;
  const admin = await one<{ id: string }>(`INSERT INTO admins (email, name, role, password_hash, brand_id) VALUES ('a@example.com', 'A', 'admin', 'x', $1) RETURNING id`, [BRAND]);
  colleague = { id: admin.id, role: "admin", brandId: BRAND } as Admin;
});

beforeEach(async () => {
  await pg.exec(`TRUNCATE properties, acq_onboarding, acq_runs, acq_prospects, acq_source_records, acq_suppression, acq_consents, acq_report_recipients CASCADE;`);
  files = new Map();
  store = {
    put: async (pathname, bytes) => { files.set(pathname, bytes); return pathname; },
    get: async (ref) => files.get(ref) ?? null,
    del: async (ref) => { files.delete(ref); },
  };
});

describe("the whole journey", () => {
  it("goes from interested owner to a published listing, with two people", async () => {
    const { prospect, id } = await readyToSubmit();
    expect(await one(`SELECT status, authority_status, owner_rep_class FROM acq_prospects WHERE id = $1`, [prospect])).toEqual({
      status: "mandate_secured", authority_status: "verified", owner_rep_class: "verified_owner",
    });

    await submitForApproval(db, me, BRAND, id, LISTING, "Owner took them and agreed in writing.");
    const property = await one<{ id: string; review_status: string; price_amount: string; acq_onboarding_id: string }>(`SELECT id, review_status, price_amount::text, acq_onboarding_id FROM properties`);
    expect(property).toMatchObject({ review_status: "pending", price_amount: "85000000", acq_onboarding_id: id });
    expect(await publicProperties(db)).toEqual([]);

    await expect(approveItem(db, me, "property", property.id)).rejects.toThrow("someone else has to give the final approval");
    expect((await one<{ review_status: string }>(`SELECT review_status FROM properties`)).review_status).toBe("pending");

    await approveItem(db, colleague, "property", property.id);
    expect(await one(`SELECT review_status FROM properties`)).toEqual({ review_status: "approved" });
    expect(await one(`SELECT final_approved_by FROM acq_onboarding`)).toEqual({ final_approved_by: colleague.id });
    expect((await listOnboarding(db, me, BRAND))[0].finalApprovedAt).not.toBeNull();
  });
});

describe("starting", () => {
  it("needs someone who's expressed interest, and only once", async () => {
    const input = ownerSubmissionSchema.parse({ name: "New", phone: "0712 000 111", role: "owner", area: "Karen", propertyType: "house", intent: "sale", consent: true });
    const { id: fresh } = await saveOwnerSubmission({ db, brandId: BRAND, hashKey: "k" }, input) as { id: string };
    await expect(startOnboarding(db, me, BRAND, fresh)).rejects.toThrow("expressed interest");
    const prospect = await interestedLead();
    await startOnboarding(db, me, BRAND, prospect);
    await expect(startOnboarding(db, me, BRAND, prospect)).rejects.toThrow("already being onboarded");
  });
});

describe("the owner's upload link", () => {
  it("keeps no working copy of the secret", async () => {
    const { id } = await started();
    const token = await issueUploadLink(db, me, BRAND, id);
    expect(JSON.stringify(await db.query(`SELECT * FROM acq_onboarding_links`))).not.toContain(token);
    expect(JSON.stringify(await db.query(`SELECT * FROM acq_audit_log`))).not.toContain(token);
  });

  it("refuses a wrong, replaced, expired or closed link with the same message", async () => {
    const { id } = await started();
    const refused = "This link has expired";
    await expect(saveDocumentFromLink(deps(), "not-a-real-token-at-all-xxxx", "identity", PDF)).rejects.toThrow(refused);

    const old = await issueUploadLink(db, me, BRAND, id);
    const current = await issueUploadLink(db, me, BRAND, id);
    await expect(saveDocumentFromLink(deps(), old, "identity", PDF)).rejects.toThrow(refused);
    await saveDocumentFromLink(deps(), current, "identity", PDF);

    await db.query(`UPDATE acq_onboarding_links SET expires_at = now() - interval '1 minute'`);
    await expect(saveDocumentFromLink(deps(), current, "identity", PDF)).rejects.toThrow(refused);

    const fresh = await issueUploadLink(db, me, BRAND, id);
    await failOnboarding(db, me, BRAND, id, "Papers didn't match.");
    await expect(saveDocumentFromLink(deps(), fresh, "identity", PDF)).rejects.toThrow(refused);
  });

  it("only takes real PDFs and images, of a sensible size, with a known type", async () => {
    const { id } = await started();
    const token = await issueUploadLink(db, me, BRAND, id);
    await expect(saveDocumentFromLink(deps(), token, "identity", Buffer.from("<script>alert(1)</script>"))).rejects.toThrow("PDF, JPG, PNG or WebP");
    await expect(saveDocumentFromLink(deps(), token, "identity", Buffer.from("MZ executable"))).rejects.toThrow("PDF, JPG, PNG or WebP");
    await expect(saveDocumentFromLink(deps(), token, "identity", Buffer.alloc(0))).rejects.toThrow("Choose a file");
    await expect(saveDocumentFromLink(deps(), token, "passport_photo", PDF)).rejects.toThrow("what kind");
    await expect(saveDocumentFromLink(deps(), token, "identity", Buffer.concat([PDF, Buffer.alloc(4 * 1024 * 1024)]))).rejects.toThrow("4 MB");
    expect(files.size).toBe(0);
    expect(sniffDocumentType(PNG)).toBe("image/png");
  });
});

describe("how documents are stored", () => {
  it("is encrypted at rest, and only the right document opens", async () => {
    const { id } = await started();
    const doc = await upload(id, "identity");
    const [stored] = [...files.values()];
    expect(stored.toString("latin1")).not.toContain("national id");
    expect(stored.toString("latin1")).not.toContain("%PDF");

    expect(() => decryptDocument(KEY, "another-document", stored)).toThrow();
    expect(() => decryptDocument(Buffer.alloc(32, 9).toString("base64"), doc, stored)).toThrow();
    const tampered = Buffer.from(stored); tampered[tampered.length - 1] ^= 1;
    expect(() => decryptDocument(KEY, doc, tampered)).toThrow();
    expect(decryptDocument(KEY, doc, encryptDocument(KEY, doc, PDF))).toEqual(PDF);
  });

  it("opens for the SuperAdmin, logging each look, and for nobody else", async () => {
    const { id } = await started();
    const doc = await upload(id, "identity");
    const opened = await readDocument(deps(), me, BRAND, doc);
    expect(opened).toMatchObject({ contentType: "application/pdf", docType: "identity" });
    expect(opened!.bytes).toEqual(PDF);
    expect(await one(`SELECT actor, action, record_id FROM acq_audit_log WHERE action = 'VIEW_DOCUMENT'`)).toEqual({ actor: me.id, action: "VIEW_DOCUMENT", record_id: doc });
    await expect(readDocument(deps(), colleague, BRAND, doc)).rejects.toThrow("Only the SuperAdmin");
    expect(await readDocument(deps(), me, BRAND, "not-a-uuid")).toBeNull();
    expect(await readDocument(deps(), me, BRAND, "00000000-0000-4000-8000-0000000000ff")).toBeNull();
  });

  it("deletes the file along with its record", async () => {
    const { id } = await started();
    const doc = await upload(id, "identity");
    await removeDocument(deps(), me, BRAND, doc);
    expect(files.size).toBe(0);
    expect(await db.query(`SELECT 1 FROM acq_onboarding_documents`)).toEqual([]);
    expect((await one<{ action: string }>(`SELECT action FROM acq_audit_log WHERE action = 'DELETE_DOCUMENT'`)).action).toBe("DELETE_DOCUMENT");
  });

  it("sets deletion dates by type, and deletes what's due", async () => {
    const { id } = await started();
    const identity = await upload(id, "identity");
    const authority = await upload(id, "marketing_authority");
    const days = async (doc: string) => (await one<{ days: number }>(`SELECT delete_after - now()::date AS days FROM acq_onboarding_documents WHERE id = $1`, [doc])).days;
    expect(await days(identity)).toBe(90);
    expect(await days(authority)).toBe(1095);

    await db.query(`UPDATE acq_onboarding_documents SET delete_after = now()::date - 1 WHERE id = $1`, [identity]);
    expect(await purgeExpiredDocuments(deps())).toEqual({ deleted: 1, failed: 0 });
    expect(files.size).toBe(1);
    expect(await db.query(`SELECT 1 FROM acq_onboarding_documents`)).toHaveLength(1);
  });

  it("keeps a record when the file can't be deleted, to try again", async () => {
    const { id } = await started();
    const doc = await upload(id, "identity");
    await db.query(`UPDATE acq_onboarding_documents SET delete_after = now()::date - 1 WHERE id = $1`, [doc]);
    const failing = { ...deps(), store: { ...store, del: async () => { throw new Error("store down"); } } };
    expect(await purgeExpiredDocuments(failing)).toEqual({ deleted: 0, failed: 1 });
    expect(await db.query(`SELECT 1 FROM acq_onboarding_documents`)).toHaveLength(1);
  });

  it("runs from the morning job, and a store outage doesn't stop the report", async () => {
    const { id } = await started();
    const doc = await upload(id, "identity");
    await db.query(`UPDATE acq_onboarding_documents SET delete_after = now()::date - 1 WHERE id = $1`, [doc]);
    const down = { key: KEY, store: { ...store, del: async () => { throw new Error("down"); } } };
    expect((await runDailyJob({ db, brandId: BRAND, sendEmail: null, documents: down }, "cron")).status).toBe("completed");
    await pg.exec(`TRUNCATE acq_runs CASCADE`);
    expect((await runDailyJob({ db, brandId: BRAND, sendEmail: null, documents: { key: KEY, store } }, "cron")).status).toBe("completed");
    expect(await db.query(`SELECT 1 FROM acq_onboarding_documents`)).toEqual([]);
  });
});

describe("the storage check", () => {
  it("stores, reads back and removes a test file, leaving nothing behind", async () => {
    await probeDocumentStore({ store, key: KEY });
    expect(files.size).toBe(0);
  });

  it("fails if what comes back is wrong, and still cleans up", async () => {
    const bad = { ...store, get: async () => Buffer.alloc(64) };
    await expect(probeDocumentStore({ store: bad, key: KEY })).rejects.toThrow();
    expect(files.size).toBe(0);
  });

  it("shows up as a failed check in the morning report", async () => {
    await db.query(`INSERT INTO acq_report_recipients (brand_id, email) VALUES ($1, 'team@example.com')`, [BRAND]);
    let text = "";
    const down = { key: KEY, store: { ...store, put: async () => { throw new Error("store unreachable"); } } };
    await runDailyJob({ db, brandId: BRAND, documents: down, sendEmail: async (email) => { text = email.text; } }, "cron");
    expect(text).toContain("FAILED Document storage: Owners can't send documents: store unreachable");
  });
});

describe("the document store", () => {
  it("needs the store id and key before it does anything", () => {
    expect(missingDocumentSettings({})).toEqual(["ACQUISITION_DOCUMENT_KEY", "ACQUISITION_BLOB_STORE_ID"]);
    expect(documentStoreFromEnv({ ACQUISITION_DOCUMENT_KEY: "k", BLOB_READ_WRITE_TOKEN: "photos" })).toBeNull();
    expect(documentStoreFromEnv({ ACQUISITION_DOCUMENT_KEY: "k", ACQUISITION_BLOB_STORE_ID: "store_x" })).not.toBeNull();
  });

  describe("signing in", () => {
    const docs = () => documentStoreFromEnv({ ACQUISITION_DOCUMENT_KEY: "k", ACQUISITION_BLOB_STORE_ID: "store_docs" })!;

    beforeEach(() => vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_photos_fake"));
    afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

    it.each([
      ["fails", () => oidc.mockRejectedValue(new Error("no token"))],
      ["is empty", () => oidc.mockResolvedValue("  ")],
    ])("errors when the sign-in token %s, never reaching the file store", async (_, arrange) => {
      arrange();
      await expect(docs().store.put("x", Buffer.from("secret"))).rejects.toThrow();
      await expect(docs().store.get("x")).rejects.toThrow();
      await expect(docs().store.del("x")).rejects.toThrow();
      expect(blob.put).not.toHaveBeenCalled();
      expect(blob.get).not.toHaveBeenCalled();
      expect(blob.del).not.toHaveBeenCalled();
    });

    it("always passes the sign-in token and this store, and never a stored token", async () => {
      oidc.mockResolvedValue("short-lived-token");
      blob.put.mockResolvedValue({ pathname: "x" });
      blob.get.mockResolvedValue(null);
      await docs().store.put("x", Buffer.from("secret"));
      await docs().store.get("x");
      await docs().store.del("x");
      const expected = { oidcToken: "short-lived-token", storeId: "store_docs" };
      expect(blob.put.mock.calls[0][2]).toMatchObject({ ...expected, access: "private" });
      expect(blob.get.mock.calls[0][1]).toMatchObject({ ...expected, access: "private" });
      expect(blob.del.mock.calls[0][1]).toEqual(expected);
      expect(JSON.stringify([blob.put.mock.calls[0][2], blob.get.mock.calls[0][1], blob.del.mock.calls[0][1]])).not.toContain('"token"');
    });
  });
});

describe("the checklist", () => {
  it("needs a checked document, not just an uploaded one", async () => {
    const { id } = await started();
    await upload(id, "identity");
    await expect(confirmStep(db, me, BRAND, id, "identity")).rejects.toThrow("verify an ID");
  });

  it("goes in order: identity, then ownership, then authority", async () => {
    const { id } = await started();
    await checked(id, "ownership");
    await expect(confirmStep(db, me, BRAND, id, "ownership")).rejects.toThrow("identity first");
    await checked(id, "identity");
    await confirmStep(db, me, BRAND, id, "identity");
    await expect(confirmStep(db, me, BRAND, id, "authority")).rejects.toThrow("ownership or authority first");
    await confirmStep(db, me, BRAND, id, "ownership");
    await expect(confirmStep(db, me, BRAND, id, "authority")).rejects.toThrow("price and terms first");
    await confirmStep(db, me, BRAND, id, "terms", TERMS);
    await expect(confirmStep(db, me, BRAND, id, "authority")).rejects.toThrow("marketing authority first");
  });

  it("keeps someone with only authority as a representative, never an owner", async () => {
    const { prospect, id } = await started();
    await checked(id, "identity"); await confirmStep(db, me, BRAND, id, "identity");
    await checked(id, "authority"); await confirmStep(db, me, BRAND, id, "ownership");
    expect(await one(`SELECT owner_rep_class, authority_status FROM acq_prospects WHERE id = $1`, [prospect])).toEqual({ owner_rep_class: "representative", authority_status: "verified" });
  });

  it("needs real terms", async () => {
    const { id } = await started();
    await expect(confirmStep(db, me, BRAND, id, "terms", { ...TERMS, amount: "0" })).rejects.toThrow("agreed price");
    await expect(confirmStep(db, me, BRAND, id, "terms", { ...TERMS, terms: "" })).rejects.toThrow("marketing terms");
  });

  it("can't send for approval with anything missing, or without photo rights and a photo", async () => {
    const { id } = await started();
    await expect(submitForApproval(db, me, BRAND, id, LISTING, "Owner")).rejects.toThrow("Still to confirm: identity, ownership or authority, availability, price and terms, the signed marketing authority.");
    const ready = await pg.exec(`TRUNCATE acq_onboarding, acq_prospects CASCADE`).then(readyToSubmit);
    await expect(submitForApproval(db, me, BRAND, ready.id, LISTING, "")).rejects.toThrow("rights");
    await expect(submitForApproval(db, me, BRAND, ready.id, { ...LISTING, heroUrl: "" }, "Owner agreed")).rejects.toThrow("main photo");
    expect(await db.query(`SELECT 1 FROM properties`)).toEqual([]);
  });

  it("closes the link once submitted, and can't be submitted twice", async () => {
    const { id } = await readyToSubmit();
    await submitForApproval(db, me, BRAND, id, LISTING, "Owner agreed");
    await expect(issueUploadLink(db, me, BRAND, id)).rejects.toThrow("already been submitted");
    await expect(submitForApproval(db, me, BRAND, id, LISTING, "Owner agreed")).rejects.toThrow("already been submitted");
    expect(await db.query(`SELECT 1 FROM acq_onboarding_links WHERE revoked_at IS NULL`)).toEqual([]);
  });

  it("stops when documents don't check out, removing any verification", async () => {
    const { prospect, id } = await started();
    await checked(id, "identity"); await confirmStep(db, me, BRAND, id, "identity");
    await checked(id, "ownership"); await confirmStep(db, me, BRAND, id, "ownership");
    await expect(failOnboarding(db, me, BRAND, id, "")).rejects.toThrow("why");
    await failOnboarding(db, me, BRAND, id, "The title doesn't match.");
    expect(await one(`SELECT authority_status, owner_rep_class FROM acq_prospects WHERE id = $1`, [prospect])).toEqual({ authority_status: "failed", owner_rep_class: "unknown" });
    await expect(confirmStep(db, me, BRAND, id, "availability")).rejects.toThrow("was stopped");
    expect((await listOnboarding(db, me, BRAND))[0].failedReason).toBe("The title doesn't match.");
  });
});

it("keeps every step from other roles", async () => {
  const { id } = await started();
  const doc = await upload(id, "identity");
  const refused = "Only the SuperAdmin";
  await expect(startOnboarding(db, colleague, BRAND, id)).rejects.toThrow(refused);
  await expect(issueUploadLink(db, colleague, BRAND, id)).rejects.toThrow(refused);
  await expect(saveDocumentAsStaff(deps(), colleague, BRAND, id, "identity", PDF)).rejects.toThrow(refused);
  await expect(verifyDocument(db, colleague, BRAND, doc)).rejects.toThrow(refused);
  await expect(removeDocument(deps(), colleague, BRAND, doc)).rejects.toThrow(refused);
  await expect(confirmStep(db, colleague, BRAND, id, "availability")).rejects.toThrow(refused);
  await expect(failOnboarding(db, colleague, BRAND, id, "no")).rejects.toThrow(refused);
  await expect(submitForApproval(db, colleague, BRAND, id, LISTING, "x")).rejects.toThrow(refused);
  await expect(listOnboarding(db, colleague, BRAND)).rejects.toThrow(refused);
});
