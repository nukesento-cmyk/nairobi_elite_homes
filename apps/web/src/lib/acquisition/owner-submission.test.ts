// @vitest-environment node
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Admin, Db } from "@/lib/admin/accounts";

import { runDailyJob } from "./daily-job";
import { approveLead, listLeads } from "./dashboard";
import { OWNER_CONSENT_VERSION, OWNER_CONSENT_WORDING, ownerSubmissionSchema, type OwnerSubmission } from "./owner-form";
import { saveOwnerSubmission } from "./owner-submission";
import { hashContact } from "./research";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const BRAND = "00000000-0000-4000-8000-000000000001";
const KEY = "test-key";
const form = {
  name: "Jane Doe", phone: "0712 345 678", email: "Jane@Example.com", role: "owner", area: "Karen", propertyType: "house",
  intent: "sale", askingPriceKes: "85000000", details: "Four bedrooms on half an acre.", consent: true,
};
const valid = (over: object = {}): OwnerSubmission => ownerSubmissionSchema.parse({ ...form, ...over });

let pg: PGlite;
let db: Db;
const one = async <Row,>(text: string, params: unknown[] = []) => (await db.query<Row>(text, params))[0];
const save = (input: OwnerSubmission) => saveOwnerSubmission({ db, brandId: BRAND, hashKey: KEY }, input);

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8"));
  db = { query: async <Row,>(text: string, params: unknown[] = []) => (await pg.query<Row>(text, params)).rows };
});

beforeEach(async () => {
  await pg.exec(`TRUNCATE acq_runs, acq_prospects, acq_source_records, acq_suppression, acq_consents, acq_report_recipients CASCADE; UPDATE acq_settings SET research_enabled = false;`);
});

describe("the form's rules", () => {
  const errorsFor = (over: object) => {
    const result = ownerSubmissionSchema.safeParse({ ...form, ...over });
    return result.success ? {} : result.error.flatten().fieldErrors;
  };

  it("won't accept a submission without consent", () => {
    expect(errorsFor({ consent: false }).consent).toBeTruthy();
    expect(errorsFor({ consent: undefined }).consent).toBeTruthy();
  });

  it("needs the essentials, with a clear message for each", () => {
    for (const field of ["name", "phone", "role", "area", "propertyType", "intent"]) {
      expect(errorsFor({ [field]: undefined })[field as "name"], field).toBeTruthy();
    }
  });

  it("treats blank optional fields as missing, not as errors", () => {
    expect(valid({ email: "", askingPriceKes: "", details: "", organisation: "" })).toMatchObject({ name: "Jane Doe" });
    expect(valid({ email: "" }).email).toBeUndefined();
    expect(valid({ askingPriceKes: "" }).askingPriceKes).toBeUndefined();
  });

  it("rejects a bad email or a negative price", () => {
    expect(errorsFor({ email: "not an email" }).email).toBeTruthy();
    expect(errorsFor({ askingPriceKes: "-5" }).askingPriceKes).toBeTruthy();
    expect(errorsFor({ askingPriceKes: "lots" }).askingPriceKes).toBeTruthy();
  });
});

describe("saving a submission", () => {
  it("creates a lead for approval, as the person's own statement rather than proof", async () => {
    expect((await save(valid())).outcome).toBe("saved");
    const prospect = await one(`SELECT display_name, prospect_type, category, status, owner_rep_class, authority_status, campaign, canonical_key FROM acq_prospects`);
    expect(prospect).toEqual({
      display_name: "Jane Doe", prospect_type: "person", category: "home_seller", status: "researched",
      owner_rep_class: "claims_owner", authority_status: "self_declared", campaign: "premium_sales", canonical_key: "phone:+254712345678",
    });
  });

  it("saves their contacts as owner submitted, and the property with the stated price", async () => {
    await save(valid());
    const contacts = await db.query<{ normalised_value: string; contact_class: string }>(`SELECT normalised_value, contact_class FROM acq_contacts ORDER BY kind`);
    expect(contacts).toEqual([
      { normalised_value: "jane@example.com", contact_class: "owner_submitted" },
      { normalised_value: "+254712345678", contact_class: "owner_submitted" },
    ]);
    expect(await one(`SELECT area, property_type, intent, asking_amount::text AS price, asking_currency FROM acq_opportunities`)).toEqual({
      area: "Karen", property_type: "house", intent: "sale", price: "85000000", asking_currency: "KES",
    });
  });

  it("records the exact words agreed to, for each contact, and keeps them unchanged", async () => {
    await save(valid());
    const consents = await db.query<{ value_hash: string; wording: string; wording_version: string }>(`SELECT value_hash, wording, wording_version FROM acq_consents`);
    expect(consents.map((row) => row.value_hash).sort()).toEqual([hashContact(KEY, "email", "jane@example.com"), hashContact(KEY, "phone", "+254712345678")].sort());
    expect(consents[0]).toMatchObject({ wording: OWNER_CONSENT_WORDING, wording_version: OWNER_CONSENT_VERSION });
    await expect(db.query(`UPDATE acq_consents SET wording = 'x'`)).rejects.toThrow("append-only");
    expect(JSON.stringify(consents)).not.toContain("0712");
  });

  it("can be approved straight away, because they consented", async () => {
    const result = await save(valid());
    const [{ id }] = await db.query<{ id: string }>(`INSERT INTO admins (email, name, role, password_hash) VALUES ('s@example.com', 'S', 'superadmin', 'x') ON CONFLICT (role) WHERE role = 'superadmin' DO UPDATE SET name = EXCLUDED.name RETURNING id`);
    const superadmin = { id, role: "superadmin" } as Admin;
    await approveLead(db, superadmin, BRAND, (result as { id: string }).id);
    const [lead] = await listLeads(db, superadmin, BRAND);
    expect(lead.status).toBe("ready_to_call");
    expect(lead.contacts.every((contact) => contact.callable)).toBe(true);
    expect(lead.evidence.map((item) => item.url)).toContain("owner-form");
  });

  it("writes a script that thanks them, doesn't assume ownership, and offers the opt-out", async () => {
    await save(valid({ area: "Elsewhere in Nairobi" }));
    const { opening_script: script } = await one<{ opening_script: string }>(`SELECT opening_script FROM acq_prospects`);
    expect(script).toContain("Thank you for submitting your house in Nairobi through our website.");
    expect(script).toContain("just say so and we'll remove your details");
    expect(script).not.toMatch(/\byou own\b|the owner/i);
  });

  it("records a representative as one, and a company as an organisation", async () => {
    await save(valid({ role: "manager", organisation: "Acme Managers", propertyType: "building", intent: "rent" }));
    expect(await one(`SELECT display_name, prospect_type, category, owner_rep_class, campaign FROM acq_prospects`)).toEqual({
      display_name: "Jane Doe, Acme Managers", prospect_type: "organisation", category: "management_company", owner_rep_class: "representative", campaign: "portfolio",
    });
  });

  it("refuses a phone number that isn't Kenyan, keeping nothing", async () => {
    expect(await save(valid({ phone: "+1 415 555 0100" }))).toEqual({ outcome: "not_kenyan_phone" });
    expect(await db.query(`SELECT 1 FROM acq_prospects`)).toEqual([]);
  });

  it("makes no lead and no consent record for someone who opted out", async () => {
    await db.query(`INSERT INTO acq_suppression (value_hash) VALUES ($1)`, [hashContact(KEY, "phone", "+254712345678")]);
    expect(await save(valid())).toEqual({ outcome: "suppressed" });
    expect(await db.query(`SELECT 1 FROM acq_prospects`)).toEqual([]);
    expect(await db.query(`SELECT 1 FROM acq_consents`)).toEqual([]);
    expect(await db.query(`SELECT 1 FROM acq_source_records`)).toEqual([]);
  });

  it("adds a second property to the same person rather than a duplicate", async () => {
    await save(valid());
    await save(valid({ area: "Runda", details: "Another one." }));
    expect(await db.query(`SELECT 1 FROM acq_prospects`)).toHaveLength(1);
    expect(await db.query(`SELECT 1 FROM acq_opportunities`)).toHaveLength(2);
    expect(await db.query(`SELECT 1 FROM acq_contacts`)).toHaveLength(2);
  });

  it("flags a contact already held under another person for review", async () => {
    await save(valid());
    await save(valid({ phone: "0733 000 111", name: "Someone Else" }));
    expect((await one<{ reason: string }>(`SELECT reason FROM acq_duplicate_candidates`)).reason).toBe("Shares a contact");
  });

  it("stores free text as given, leaving escaping to where it's displayed", async () => {
    await save(valid({ details: "<script>alert(1)</script>" }));
    const [lead] = await db.query<{ quote: string }>(`SELECT quote FROM acq_evidence WHERE claim_type = 'property_detail'`);
    expect(lead.quote).toBe("<script>alert(1)</script>");
  });
});

describe("the morning report", () => {
  const report = async () => {
    let email = { subject: "", text: "", html: "" };
    await db.query(`INSERT INTO acq_report_recipients (brand_id, email) VALUES ($1, 'team@example.com')`, [BRAND]);
    await runDailyJob({ db, brandId: BRAND, sendEmail: async (sent) => { email = sent; } }, "cron");
    return email;
  };

  it("is a real report when someone submitted, even with research off, without their contacts", async () => {
    await save(valid({ details: "<script>alert(1)</script>" }));
    const { subject, text, html } = await report();
    expect(subject).not.toContain("TEST");
    expect(text).toContain("Jane Doe");
    expect(text).toContain("1  owner form submissions");
    expect(text).not.toContain("invented");
    expect(`${text}${html}`).not.toContain("+254");
    expect(`${text}${html}`).not.toContain("jane@example.com");
    expect(html).not.toContain("<script>");
  });

  it("stays a labelled test report when research is off and nobody submitted", async () => {
    expect((await report()).subject).toContain("[TEST, no real leads]");
  });
});
