// @vitest-environment node
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authenticate, canManage, canManageGroups, canManageProperties, canManageUsers, canRemoveContent, canReview, canWritePosts, createAdmin, manageableRoles,
  type Admin, type Db,
} from "@/lib/admin/accounts";
import { hashPassword } from "@/lib/admin/password";
import { authenticateBuyer, createUser } from "@/lib/buyers";

import { logCall, markDoNotContact, suppressContact } from "./calls";
import { runDailyJob } from "./daily-job";
import {
  addRecipient, approveLead, clearPossibleDuplicates, countDoNotContact, decideDomain, listLeads, listPendingDomains, listRecipients, listReports, rejectLead, setResearchEnabled,
} from "./dashboard";
import { listOnboarding, readDocument, startOnboarding } from "./onboarding";
import { ownerSubmissionSchema } from "./owner-form";
import { saveOwnerSubmission } from "./owner-submission";
import { hashContact } from "./research";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const BRAND = "00000000-0000-4000-8000-000000000001";
const KEY = "test-key";
const TODAY = "2026-11-05";
const FUTURE = "2099-01-15";

let pg: PGlite;
let db: Db;
let me: Admin;
const one = async <Row,>(text: string, params: unknown[] = []) => (await db.query<Row>(text, params))[0];
const status = async (id: string) => (await one<{ status: string }>(`SELECT status FROM acq_prospects WHERE id = $1`, [id])).status;

const newLead = async (approve = true, phone = "0712 345 678") => {
  const input = ownerSubmissionSchema.parse({ name: `Jane ${phone}`, phone, email: `j${phone.replace(/\D/g, "")}@example.com`, role: "owner", area: "Karen", propertyType: "house", intent: "sale", consent: true });
  const result = await saveOwnerSubmission({ db, brandId: BRAND, hashKey: KEY }, input);
  const id = (result as { id: string }).id;
  if (approve) await approveLead(db, me, BRAND, id);
  return id;
};
const call = (id: string, over: object = {}) =>
  logCall(db, me, BRAND, id, { outcome: "answered", notes: "", optOutLineRead: true, nextFollowUp: "", ...over }, TODAY);

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8"));
  db = { query: async <Row,>(text: string, params: unknown[] = []) => (await pg.query<Row>(text, params)).rows };
  const { id } = await one<{ id: string }>(`INSERT INTO admins (email, name, role, password_hash) VALUES ('s@example.com', 'S', 'superadmin', 'x') RETURNING id`);
  me = { id, role: "superadmin" } as Admin;
});

beforeEach(async () => {
  await pg.exec(`TRUNCATE acq_runs, acq_prospects, acq_source_records, acq_suppression, acq_consents, acq_report_recipients CASCADE;`);
});

describe("logging a call", () => {
  it("records who called, what happened and whether the opt-out line was read", async () => {
    const id = await newLead();
    await call(id, { notes: "Wants a callback." });
    expect(await one(`SELECT caller_id, channel, outcome, opt_out_line_read, notes FROM acq_interactions`)).toEqual({
      caller_id: me.id, channel: "call", outcome: "answered", opt_out_line_read: true, notes: "Wants a callback.",
    });
    expect(await status(id)).toBe("contacted");
  });

  it("won't save a real conversation unless the opt-out line was read", async () => {
    const id = await newLead();
    for (const outcome of ["answered", "interested", "meeting_booked", "not_interested"]) {
      await expect(call(id, { outcome, optOutLineRead: false })).rejects.toThrow("can opt out");
    }
    expect(await db.query(`SELECT 1 FROM acq_interactions`)).toEqual([]);
  });

  it("doesn't need the line where there was no conversation", async () => {
    const id = await newLead();
    await call(id, { outcome: "no_answer", optOutLineRead: false });
    await call(id, { outcome: "wrong_person", optOutLineRead: false });
    expect(await status(id)).toBe("ready_to_call");
  });

  it("moves through the stages, even when one call books a meeting straight away", async () => {
    const id = await newLead();
    await call(id, { outcome: "meeting_booked" });
    expect(await status(id)).toBe("meeting_scheduled");
  });

  it("never moves someone backwards", async () => {
    const id = await newLead();
    await call(id, { outcome: "interested" });
    await call(id, { outcome: "answered" });
    expect(await status(id)).toBe("interested");
  });

  it("closes a not-interested lead, which leaves the list", async () => {
    const id = await newLead();
    await call(id, { outcome: "not_interested" });
    expect(await status(id)).toBe("rejected");
    expect(await listLeads(db, me, BRAND)).toEqual([]);
  });

  it("refuses a call on a lead nobody approved", async () => {
    const id = await newLead(false);
    await expect(call(id)).rejects.toThrow("Approve this lead");
  });

  it("refuses a call on someone who opted out", async () => {
    const id = await newLead();
    await markDoNotContact(db, me, BRAND, id);
    await expect(call(id)).rejects.toThrow("asked not to be contacted");
  });

  it("rejects an unknown outcome, a missing lead and notes that are too long", async () => {
    const id = await newLead();
    await expect(call(id, { outcome: "made_up" })).rejects.toThrow("Choose what happened");
    await expect(call(id, { outcome: null })).rejects.toThrow("Choose what happened");
    await expect(call(id, { notes: "x".repeat(2001) })).rejects.toThrow("2,000");
    await expect(call("00000000-0000-4000-8000-0000000000ff")).rejects.toThrow("no longer exists");
  });
});

describe("follow-ups", () => {
  it("sets the date and shows it on the lead", async () => {
    const id = await newLead();
    await call(id, { outcome: "no_answer", optOutLineRead: false, nextFollowUp: FUTURE });
    expect(await status(id)).toBe("follow_up");
    const [lead] = await listLeads(db, me, BRAND);
    expect(lead).toMatchObject({ nextFollowUp: FUTURE, followUpDue: false });
    expect(lead.calls[0]).toMatchObject({ outcome: "no_answer" });
  });

  it("refuses a date in the past, or a follow-up with someone who said no", async () => {
    const id = await newLead();
    await expect(call(id, { nextFollowUp: "2020-01-01" })).rejects.toThrow("today or later");
    await expect(call(id, { nextFollowUp: "soon" })).rejects.toThrow("valid date");
    await expect(call(id, { outcome: "not_interested", nextFollowUp: FUTURE })).rejects.toThrow("said no");
    await expect(call(id, { outcome: "opt_out", nextFollowUp: FUTURE })).rejects.toThrow("said no");
    expect(await status(id)).toBe("ready_to_call");
  });

  it("puts due follow-ups first, and clears one once it's dealt with", async () => {
    const later = await newLead(true, "0712 000 001");
    const due = await newLead(true, "0712 000 002");
    await call(later, { outcome: "no_answer", optOutLineRead: false, nextFollowUp: FUTURE });
    await db.query(`UPDATE acq_prospects SET status = 'follow_up', next_follow_up_at = now() - interval '1 hour' WHERE id = $1`, [due]);
    const [first] = await listLeads(db, me, BRAND);
    expect(first).toMatchObject({ id: due, followUpDue: true });

    await call(due, { outcome: "interested" });
    expect(await one(`SELECT status, next_follow_up_at FROM acq_prospects WHERE id = $1`, [due])).toEqual({ status: "interested", next_follow_up_at: null });
  });

  it("keeps a due follow-up when nobody answered", async () => {
    const id = await newLead();
    await db.query(`UPDATE acq_prospects SET status = 'follow_up', next_follow_up_at = now() - interval '1 hour' WHERE id = $1`, [id]);
    await call(id, { outcome: "no_answer", optOutLineRead: false });
    expect((await listLeads(db, me, BRAND))[0].followUpDue).toBe(true);
  });

  it("gives a real report when follow-ups are due, even with no new leads", async () => {
    const id = await newLead();
    await db.query(`UPDATE acq_prospects SET status = 'follow_up', next_follow_up_at = now() - interval '1 hour', created_at = now() - interval '5 days' WHERE id = $1`, [id]);
    await db.query(`INSERT INTO acq_report_recipients (brand_id, email) VALUES ($1, 'team@example.com')`, [BRAND]);
    let email = { subject: "", text: "" };
    await runDailyJob({ db, brandId: BRAND, sendEmail: async (sent) => { email = sent; } }, "cron");
    expect(email.subject).not.toContain("TEST");
    expect(email.text).toContain("1  follow-ups due");
  });
});

describe("opting out", () => {
  const suppressed = async (kind: string, value: string) =>
    (await db.query(`SELECT 1 FROM acq_suppression WHERE value_hash = $1`, [hashContact(KEY, kind, value)])).length === 1;

  it("on a call: suppresses all their contacts, logs it and takes them off the list", async () => {
    const id = await newLead();
    await call(id, { outcome: "opt_out", optOutLineRead: false, notes: "Asked to be removed." });
    expect(await status(id)).toBe("do_not_contact");
    expect(await suppressed("phone", "+254712345678")).toBe(true);
    expect(await suppressed("email", "j0712345678@example.com")).toBe(true);
    expect((await one<{ outcome: string }>(`SELECT outcome FROM acq_interactions`)).outcome).toBe("opt_out");
    expect(await listLeads(db, me, BRAND)).toEqual([]);
    expect(await countDoNotContact(db, me)).toBe(2);
  });

  it("still applies the opt-out if saving the call then fails", async () => {
    const id = await newLead();
    const failing: Db = { query: async <Row,>(text: string, params?: unknown[]) => {
      if (text.includes("INSERT INTO acq_interactions")) throw new Error("database hiccup");
      return db.query<Row>(text, params);
    } };
    await expect(logCall(failing, me, BRAND, id, { outcome: "opt_out", notes: "", optOutLineRead: false, nextFollowUp: "" }, TODAY)).rejects.toThrow("hiccup");
    expect(await status(id)).toBe("do_not_contact");
  });

  it("from the button: works before approval, with the change audited", async () => {
    const id = await newLead(false);
    await markDoNotContact(db, me, BRAND, id);
    expect(await status(id)).toBe("do_not_contact");
    const audit = await db.query<{ actor: string }>(`SELECT actor FROM acq_audit_log WHERE table_name = 'acq_prospects' AND record_id = $1 AND after ->> 'status' = 'do_not_contact'`, [id]);
    expect(audit[0].actor).toBe(me.id);
  });

  it("blocks a later owner form submission from them", async () => {
    const id = await newLead();
    await markDoNotContact(db, me, BRAND, id);
    const input = ownerSubmissionSchema.parse({ name: "Jane Doe", phone: "0712 345 678", role: "owner", area: "Runda", propertyType: "house", intent: "sale", consent: true });
    expect(await saveOwnerSubmission({ db, brandId: BRAND, hashKey: KEY }, input)).toEqual({ outcome: "suppressed" });
  });

  describe("by hand", () => {
    it("adds someone who isn't a lead, in any phone format", async () => {
      await suppressContact(db, me, BRAND, KEY, " +254 722 111 222 ");
      expect(await suppressed("phone", "+254722111222")).toBe(true);
      await suppressContact(db, me, BRAND, KEY, "0722111222");
      expect(await countDoNotContact(db, me)).toBe(1);
    });

    it("keeps only a scrambled value", async () => {
      await suppressContact(db, me, BRAND, KEY, "someone@example.com");
      expect(JSON.stringify(await db.query(`SELECT * FROM acq_suppression`))).not.toContain("someone");
      expect(JSON.stringify(await db.query(`SELECT * FROM acq_audit_log WHERE table_name = 'acq_suppression'`))).not.toContain("someone");
    });

    it("marks a lead holding that contact, and blocks future calls", async () => {
      const id = await newLead();
      await suppressContact(db, me, BRAND, KEY, "J0712345678@Example.com");
      expect(await status(id)).toBe("do_not_contact");
      expect(await suppressed("phone", "+254712345678")).toBe(true);
    });

    it("refuses what it can't recognise, and fails plainly with no key", async () => {
      await expect(suppressContact(db, me, BRAND, KEY, "hello")).rejects.toThrow("Kenyan phone number or an email");
      await expect(suppressContact(db, me, BRAND, KEY, "+1 415 555 0100")).rejects.toThrow("Kenyan phone number or an email");
      await expect(suppressContact(db, me, BRAND, undefined, "0722111222")).rejects.toThrow("ACQUISITION_HASH_KEY");
    });
  });
});

describe("possible duplicates", () => {
  const twoNamesake = async () => {
    const save = (phone: string) => saveOwnerSubmission(
      { db, brandId: BRAND, hashKey: KEY },
      ownerSubmissionSchema.parse({ name: "Jane Doe", phone, role: "owner", area: "Karen", propertyType: "house", intent: "sale", consent: true }),
    );
    const first = (await save("0712 000 011") as { id: string }).id;
    const second = (await save("0712 000 022") as { id: string }).id;
    return { first, second };
  };

  it("shows the match, and blocks approval until a person has looked", async () => {
    const { second } = await twoNamesake();
    const lead = (await listLeads(db, me, BRAND)).find((row) => row.id === second)!;
    expect(lead.possibleDuplicates).toEqual([{ name: "Jane Doe", reason: "Same name" }]);
    await expect(approveLead(db, me, BRAND, second)).rejects.toThrow("unresolved possible duplicate");
  });

  it("clears for both leads once marked as different, recording who decided", async () => {
    const { first, second } = await twoNamesake();
    await clearPossibleDuplicates(db, me, BRAND, second);
    expect(await one(`SELECT status, resolved_by FROM acq_duplicate_candidates`)).toEqual({ status: "not_duplicate", resolved_by: me.id });
    await approveLead(db, me, BRAND, first);
    await approveLead(db, me, BRAND, second);
    expect(await status(second)).toBe("ready_to_call");
  });
});

describe("a caller", () => {
  let caller: Admin;
  beforeAll(async () => {
    const row = await one<{ id: string }>(`INSERT INTO admins (email, name, role, password_hash, brand_id, must_change_password) VALUES ('caller@example.com', 'C', 'caller', 'x', $1, false) RETURNING id`, [BRAND]);
    caller = { id: row.id, role: "caller", brandId: BRAND } as Admin;
  });
  const logged = (id: string, over: object = {}) =>
    logCall(db, caller, BRAND, id, { outcome: "interested", notes: "From a caller.", optOutLineRead: true, nextFollowUp: "", ...over }, TODAY);

  it("sees approved leads only, and logs calls as themselves", async () => {
    await newLead(false, "0712 000 031");
    const approved = await newLead(true, "0712 000 032");
    expect((await listLeads(db, caller, BRAND)).map((lead) => lead.id)).toEqual([approved]);
    await logged(approved);
    expect((await one<{ caller_id: string }>(`SELECT caller_id FROM acq_interactions`)).caller_id).toBe(caller.id);
    expect(await status(approved)).toBe("interested");
  });

  it("never gets a locked contact, even on an approved lead", async () => {
    const id = await newLead(true, "0712 000 033");
    await db.query(`UPDATE acq_contacts SET contact_class = 'individual_published' WHERE normalised_value LIKE 'j%' AND prospect_id = $1`, [id]);
    const values = (await listLeads(db, caller, BRAND))[0].contacts.map((contact) => contact.value);
    expect(values).toEqual(["+254712000033"]);
    expect((await listLeads(db, me, BRAND))[0].contacts).toHaveLength(2);
  });

  it("sees no other brand's leads", async () => {
    await newLead(true, "0712 000 034");
    const other = { ...caller, brandId: "00000000-0000-4000-8000-0000000000bb" } as Admin;
    await expect(listLeads(db, other, BRAND)).rejects.toThrow("access to leads");
    const [{ id: brand }] = await db.query<{ id: string }>(`INSERT INTO brands (name, slug) VALUES ('Other', 'other') RETURNING id`);
    expect(await listLeads(db, me, brand)).toEqual([]);
    await pg.exec(`DELETE FROM brands WHERE slug = 'other'`);
  });

  it("can record opt-outs, on a lead or for anyone else", async () => {
    const id = await newLead(true, "0712 000 035");
    await markDoNotContact(db, caller, BRAND, id);
    expect(await status(id)).toBe("do_not_contact");
    await suppressContact(db, caller, BRAND, KEY, "0722 333 444");
    expect(await countDoNotContact(db, caller)).toBeGreaterThan(0);
  });

  it("can do nothing else in acquisition", async () => {
    const id = await newLead(false, "0712 000 036");
    const refused = "Only the SuperAdmin";
    await expect(approveLead(db, caller, BRAND, id)).rejects.toThrow(refused);
    await expect(rejectLead(db, caller, BRAND, id)).rejects.toThrow(refused);
    await expect(clearPossibleDuplicates(db, caller, BRAND, id)).rejects.toThrow(refused);
    await expect(listReports(db, caller, BRAND)).rejects.toThrow(refused);
    await expect(listRecipients(db, caller, BRAND)).rejects.toThrow(refused);
    await expect(addRecipient(db, caller, BRAND, "x@example.com")).rejects.toThrow(refused);
    await expect(listPendingDomains(db, caller, BRAND)).rejects.toThrow(refused);
    await expect(decideDomain(db, caller, BRAND, id, "allowed", "")).rejects.toThrow(refused);
    await expect(setResearchEnabled(db, caller, BRAND, true)).rejects.toThrow(refused);
    await expect(startOnboarding(db, caller, BRAND, id)).rejects.toThrow(refused);
    await expect(listOnboarding(db, caller, BRAND)).rejects.toThrow(refused);
    await expect(readDocument({ db, key: "k", store: { put: async () => "", get: async () => null, del: async () => {} } }, caller, BRAND, id)).rejects.toThrow(refused);
  });

  it("holds no other staff permission", () => {
    expect(canReview(caller)).toBe(false);
    expect(canManageProperties(caller)).toBe(false);
    expect(canWritePosts(caller)).toBe(false);
    expect(canRemoveContent(caller)).toBe(false);
    expect(canManageUsers(caller)).toBe(false);
    expect(canManageGroups(caller)).toBe(false);
    expect(manageableRoles(caller)).toEqual([]);
  });

  it("can be created by a SuperAdmin or admin, on the main brand only, and starts with a temporary password", async () => {
    const created = await createAdmin(db, me, { email: "new.caller@example.com", name: "New Caller", role: "caller", brandId: BRAND });
    expect(created.admin).toMatchObject({ role: "caller", brandId: BRAND, mustChangePassword: true });
    expect(created.temporaryPassword).toBeTruthy();
    await expect(createAdmin(db, me, { email: "b@example.com", name: "B Caller", role: "caller", brandId: "00000000-0000-4000-8000-0000000000cc" })).rejects.toThrow("main brand");
    await expect(createAdmin(db, caller, { email: "c@example.com", name: "C Caller", role: "caller" })).rejects.toThrow("can't create");
    await expect(createAdmin(db, caller, { email: "d@example.com", name: "D Admin", role: "admin" })).rejects.toThrow("can't create");
    await pg.exec(`DELETE FROM admins WHERE email = 'new.caller@example.com'`);
  });

  it("explains itself, rather than crashing the page, if the database doesn't allow the role yet", async () => {
    const outdated: Db = { query: async () => { throw Object.assign(new Error("violates check constraint"), { code: "23514" }); } };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createAdmin(outdated, me, { email: "e@example.com", name: "E Caller", role: "caller", brandId: BRAND })).rejects.toThrow("isn't ready for this role");
    quiet.mockRestore();
  });

  it("is managed by the brand's admins, like a reviewer, and can't touch anyone", () => {
    const admin = { id: "a", role: "admin", brandId: BRAND } as Admin;
    expect(canManage(admin, { role: "caller", brandId: BRAND, createdBy: "someone" })).toBe(true);
    expect(canManage(caller, { role: "caller", brandId: BRAND, createdBy: caller.id })).toBe(false);
    expect(canManage(caller, { role: "reviewer", brandId: BRAND, createdBy: caller.id })).toBe(false);
  });

  it("signs in at the staff login, and a User can't", async () => {
    const password = "a-local-test-password";
    await db.query(`UPDATE admins SET password_hash = $1 WHERE id = $2`, [await hashPassword(password), caller.id]);
    expect((await authenticate(db, { email: "caller@example.com", password })).role).toBe("caller");
    const user = await createUser(db, me, { email: "visitor@example.com", name: "Site Visitor", brandId: BRAND });
    await expect(authenticate(db, { email: "visitor@example.com", password: user.temporaryPassword })).rejects.toThrow("don't match");
    expect((await authenticateBuyer(db, { email: "visitor@example.com", password: user.temporaryPassword })).mustChangePassword).toBe(true);
    await db.query(`DELETE FROM buyers WHERE email = 'visitor@example.com'`);
  });
});

it("keeps every part of this from other roles", async () => {
  const admin = { ...me, role: "admin" } as Admin;
  const id = await newLead();
  await expect(logCall(db, admin, BRAND, id, { outcome: "answered", notes: "", optOutLineRead: true, nextFollowUp: "" }, TODAY)).rejects.toThrow("access to leads");
  await expect(markDoNotContact(db, admin, BRAND, id)).rejects.toThrow("access to leads");
  await expect(suppressContact(db, admin, BRAND, KEY, "0722111222")).rejects.toThrow("access to leads");
  await expect(countDoNotContact(db, admin)).rejects.toThrow("access to leads");
  await expect(listLeads(db, admin, BRAND)).rejects.toThrow("access to leads");
  await expect(clearPossibleDuplicates(db, admin, BRAND, id)).rejects.toThrow("Only the SuperAdmin");
});
