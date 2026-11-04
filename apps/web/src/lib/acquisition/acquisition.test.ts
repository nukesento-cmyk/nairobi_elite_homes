// @vitest-environment node
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Admin, Db } from "@/lib/admin/accounts";

import { emailSender, isAuthorizedCron, missingConfig, monitorPinger, recipients } from "./cron";
import { DAILY_JOB, runDailyJob, type Email } from "./daily-job";
import { addRecipient, canViewAcquisition, listRecipients, listReports, removeRecipient, sendReportTo } from "./dashboard";
import { fetchPage, htmlToText } from "./fetcher";
import { checkSourcePolicy, publicHost } from "./policy";
import { buildDailyReport } from "./report";
import { robotsAllows } from "./robots";
import { nairobiDate, runJob, type Step } from "./runner";
import { SAMPLE_LEADS } from "./sample-leads";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const BRAND = "00000000-0000-4000-8000-000000000001";
const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8");

let pg: PGlite;
let db: Db;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(schema);
  db = { query: async <Row,>(text: string, params: unknown[] = []) => (await pg.query<Row>(text, params)).rows };
});

beforeEach(async () => {
  await pg.exec(`TRUNCATE acq_runs, acq_prospects, acq_source_records, acq_suppression, acq_onboarding, acq_report_recipients, properties CASCADE;
    DELETE FROM acq_source_policies WHERE verdict = 'pending' OR domain = 'approved.example';
    UPDATE acq_contact_class_rules SET callable = (contact_class = 'owner_submitted');`);
  await pg.exec(`INSERT INTO acq_source_policies (brand_id, domain, verdict) VALUES ('${BRAND}', 'approved.example', 'allowed');`);
});

const one = async <Row,>(text: string, params: unknown[] = []) => (await db.query<Row>(text, params))[0];

describe("source policy gate", () => {
  it("blocks portals, including their subdomains", async () => {
    for (const url of ["https://www.property24.co.ke/x", "https://m.buyrentkenya.com/y", "https://jiji.co.ke/"]) {
      expect((await checkSourcePolicy(db, BRAND, url)).allowed).toBe(false);
    }
    expect((await checkSourcePolicy(db, BRAND, "https://www.property24.co.ke/x")).verdict).toBe("blocked");
  });

  it("keeps human-only sources away from the job", async () => {
    const decision = await checkSourcePolicy(db, BRAND, "https://www.linkedin.com/company/x");
    expect(decision).toMatchObject({ allowed: false, verdict: "human_only" });
  });

  it("closes an unknown domain and queues it for a person", async () => {
    expect(await checkSourcePolicy(db, BRAND, "https://www.newsite.example/a")).toMatchObject({ allowed: false, verdict: "pending", domain: "newsite.example" });
    const row = await one<{ verdict: string }>(`SELECT verdict FROM acq_source_policies WHERE domain = 'newsite.example'`);
    expect(row.verdict).toBe("pending");
  });

  it("lets a block on a parent beat an allowed subdomain", async () => {
    await db.query(`INSERT INTO acq_source_policies (brand_id, domain, verdict) VALUES ($1, 'sale.jiji.co.ke', 'allowed')`, [BRAND]);
    expect((await checkSourcePolicy(db, BRAND, "https://sale.jiji.co.ke/")).allowed).toBe(false);
    await db.query(`DELETE FROM acq_source_policies WHERE domain = 'sale.jiji.co.ke'`);
  });

  it("refuses addresses that aren't public websites", () => {
    for (const url of ["http://localhost/a", "http://169.254.169.254/latest", "http://[::1]/", "ftp://a.example/", "https://user:pw@a.example/", "nonsense"]) {
      expect(publicHost(url)).toBeNull();
    }
  });
});

describe("robots.txt", () => {
  it("applies the longest rule and prefers our own group", () => {
    const robots = "User-agent: *\nDisallow: /\n\nUser-agent: NairobiEliteResearch\nDisallow: /private\nAllow: /private/open\n";
    expect(robotsAllows(robots, "NairobiEliteResearch", "/homes")).toBe(true);
    expect(robotsAllows(robots, "NairobiEliteResearch", "/private/x")).toBe(false);
    expect(robotsAllows(robots, "NairobiEliteResearch", "/private/open/1")).toBe(true);
    expect(robotsAllows(robots, "OtherBot", "/homes")).toBe(false);
  });

  it("handles wildcards, end anchors and an empty file", () => {
    const robots = "User-agent: *\nDisallow: /*.pdf$\n";
    expect(robotsAllows(robots, "NairobiEliteResearch", "/a/b.pdf")).toBe(false);
    expect(robotsAllows(robots, "NairobiEliteResearch", "/a/b.pdf?x=1")).toBe(true);
    expect(robotsAllows("", "NairobiEliteResearch", "/")).toBe(true);
  });
});

describe("fetcher", () => {
  const site = (pages: Record<string, () => Response>, robots: () => Response = () => new Response("", { status: 404 })) => {
    const calls: string[] = [];
    const impl = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/robots.txt") return robots();
      calls.push(url.toString());
      const page = pages[url.toString()];
      if (!page) throw new Error(`Unexpected fetch of ${url}`);
      return page();
    }) as typeof fetch;
    return { impl, calls };
  };
  const html = (body: string) => () => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });

  it("never touches the network for a blocked domain", async () => {
    const impl = vi.fn() as unknown as typeof fetch;
    const result = await fetchPage(db, BRAND, "https://www.property24.co.ke/x", impl);
    expect(result).toEqual({ outcome: "refused", reason: "policy", verdict: "blocked" });
    expect(impl).not.toHaveBeenCalled();
  });

  it("stores the readable text of an approved page", async () => {
    const { impl } = site({ "https://approved.example/a": html("<html><script>x()</script><p>Now&nbsp;selling <b>40 units</b></p></html>") });
    const result = await fetchPage(db, BRAND, "https://approved.example/a", impl);
    expect(result).toMatchObject({ outcome: "stored", extract: "Now selling 40 units" });
    const row = await one<{ outcome: string; content_sha256: string }>(`SELECT outcome, content_sha256 FROM acq_source_records`);
    expect(row.outcome).toBe("stored");
    expect(row.content_sha256).toHaveLength(64);
  });

  it("re-checks policy on redirects, so an approved page can't lead to a blocked one", async () => {
    const { impl, calls } = site({
      "https://approved.example/a": () => new Response(null, { status: 302, headers: { location: "https://www.property24.co.ke/x" } }),
    });
    expect(await fetchPage(db, BRAND, "https://approved.example/a", impl)).toMatchObject({ outcome: "refused", reason: "policy" });
    expect(calls).toEqual(["https://approved.example/a"]);
  });

  it.each([401, 403, 429])("stops on %i, logs it and doesn't retry", async (status) => {
    const { impl, calls } = site({ "https://approved.example/a": () => new Response("no", { status }) });
    expect(await fetchPage(db, BRAND, "https://approved.example/a", impl)).toEqual({ outcome: "stopped", status });
    expect(calls).toHaveLength(1);
    expect((await one<{ outcome: string }>(`SELECT outcome FROM acq_source_records`)).outcome).toBe("stopped");
  });

  it("honours robots.txt, and treats an unreadable one as a no", async () => {
    const disallowed = site({}, () => new Response("User-agent: *\nDisallow: /"));
    expect(await fetchPage(db, BRAND, "https://approved.example/a", disallowed.impl)).toEqual({ outcome: "refused", reason: "robots" });
    const broken = site({}, () => new Response("oops", { status: 500 }));
    expect(await fetchPage(db, BRAND, "https://approved.example/a", broken.impl)).toEqual({ outcome: "refused", reason: "robots" });
  });

  it("paces itself per domain", async () => {
    const { impl } = site({ "https://approved.example/a": html("<p>a</p>") });
    await fetchPage(db, BRAND, "https://approved.example/a", impl);
    expect(await fetchPage(db, BRAND, "https://approved.example/a", impl)).toEqual({ outcome: "refused", reason: "too_soon" });
  });

  it("turns markup into text without keeping scripts or comments", () => {
    expect(htmlToText("<!-- no --><style>a{}</style><p>Tom &amp; Sons</p>\n<div>2&lt;3</div>")).toBe("Tom & Sons 2<3");
  });
});

describe("run lock and resume", () => {
  const identity = { brandId: BRAND, job: "test-job", runDate: "2026-11-05", startedBy: "cron" };

  it("makes a duplicate trigger on a finished day do nothing", async () => {
    const run = vi.fn(async () => ({}));
    expect((await runJob(db, identity, [{ name: "a", run }])).status).toBe("completed");
    expect(await runJob(db, identity, [{ name: "a", run }])).toEqual({ status: "skipped", reason: "already_completed" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("lets only one of two simultaneous triggers do the work", async () => {
    const run = vi.fn(async () => ({}));
    const results = await Promise.all([runJob(db, identity, [{ name: "a", run }]), runJob(db, identity, [{ name: "a", run }])]);
    expect(results.map((result) => result.status).sort()).toEqual(["completed", "skipped"]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("leaves a run alone while another attempt holds its lease", async () => {
    await db.query(`INSERT INTO acq_runs (brand_id, job, run_date, started_by, lease_expires_at) VALUES ($1, 'test-job', '2026-11-05', 'cron', now() + interval '5 minutes')`, [BRAND]);
    const run = vi.fn(async () => ({}));
    expect(await runJob(db, identity, [{ name: "a", run }])).toEqual({ status: "skipped", reason: "already_running" });
    expect(run).not.toHaveBeenCalled();
  });

  it("resumes after a killed attempt without repeating finished steps", async () => {
    const first = vi.fn(async () => ({ value: 7 }));
    // A killed process leaves "started" with an expired lease and no failure recorded.
    const [created] = await db.query<{ id: string }>(`INSERT INTO acq_runs (brand_id, job, run_date, started_by, lease_expires_at) VALUES ($1, 'test-job', '2026-11-05', 'cron', now() - interval '1 minute') RETURNING id`, [BRAND]);
    await db.query(`INSERT INTO acq_run_events (run_id, step, status, detail) VALUES ($1, 'a', 'completed', '{"value": 7}'), ($1, 'b', 'started', '{}')`, [created.id]);

    let seen: unknown;
    const steps: Step[] = [
      { name: "a", run: first },
      { name: "b", run: async (outputs) => { seen = outputs.a; return {}; } },
    ];
    expect(await runJob(db, identity, steps)).toMatchObject({ status: "completed", attempts: 2 });
    expect(first).not.toHaveBeenCalled();
    expect(seen).toEqual({ value: 7 });
  });

  it("records a failed step, then retries from it", async () => {
    let failing = true;
    const a = vi.fn(async () => ({}));
    const steps: Step[] = [
      { name: "a", run: a },
      { name: "b", run: async () => { if (failing) throw new Error("outage"); return {}; } },
    ];
    expect(await runJob(db, identity, steps)).toMatchObject({ status: "failed", step: "b", error: "outage" });
    expect((await one<{ error: string }>(`SELECT error FROM acq_runs`)).error).toBe("b: outage");
    failing = false;
    expect((await runJob(db, identity, steps)).status).toBe("completed");
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("uses Nairobi's date, not the server's", () => {
    expect(nairobiDate(new Date("2026-11-04T20:59:00Z"))).toBe("2026-11-04");
    expect(nairobiDate(new Date("2026-11-04T21:00:00Z"))).toBe("2026-11-05");
  });
});

describe("the morning job", () => {
  const now = () => new Date("2026-11-05T03:00:00Z");
  type Over = Partial<Parameters<typeof runDailyJob>[0]> & {
    sendReport?: (email: Email) => Promise<void>;
    sendAlert?: (email: Email) => Promise<void>;
  };
  const deps = ({ sendReport, sendAlert, ...over }: Over = {}) => {
    const sent: Email[] = [];
    const alerts: Email[] = [];
    return {
      sent,
      alerts,
      deps: {
        db,
        brandId: BRAND,
        now,
        alertTo: ["alerts@example.com"],
        sendEmail: async (email: Email) => {
          const alert = email.idempotencyKey.includes("alert");
          if (alert) await sendAlert?.(email);
          else await sendReport?.(email);
          (alert ? alerts : sent).push(email);
        },
        ...over,
      },
    };
  };

  beforeEach(async () => {
    await db.query(`INSERT INTO acq_report_recipients (brand_id, email) VALUES ($1, 'team@example.com')`, [BRAND]);
  });

  it("still finishes, for the dashboard, when email isn't set up or nobody is chosen", async () => {
    const { deps: noEmail } = deps({ sendEmail: null });
    expect((await runDailyJob(noEmail, "cron")).status).toBe("completed");
    expect((await one<{ delivered_at: Date | null }>(`SELECT delivered_at FROM acq_runs`)).delivered_at).toBeNull();

    await pg.exec(`TRUNCATE acq_runs CASCADE; DELETE FROM acq_report_recipients;`);
    const { deps: nobody, sent } = deps();
    expect((await runDailyJob(nobody, "cron")).status).toBe("completed");
    expect(sent).toHaveLength(0);
  });

  it("sends to whoever the SuperAdmin chose", async () => {
    await db.query(`INSERT INTO acq_report_recipients (brand_id, email) VALUES ($1, 'second@example.com')`, [BRAND]);
    let to: string[] = [];
    const { deps: d } = deps({ sendEmail: async (_, list) => { to = list; } });
    await runDailyJob(d, "cron");
    expect(to).toEqual(["second@example.com", "team@example.com"]);
  });

  it("delivers a labelled test report, then pings the monitor", async () => {
    const order: string[] = [];
    const { deps: d } = deps({
      sendReport: async () => { order.push("email"); },
      pingMonitor: async () => { order.push("ping"); },
    });
    expect((await runDailyJob(d, "cron")).status).toBe("completed");
    expect(order).toEqual(["email", "ping"]);
    const run = await one<{ status: string; delivered_at: Date | null; job: string }>(`SELECT status, delivered_at, job FROM acq_runs`);
    expect(run).toMatchObject({ status: "completed", job: DAILY_JOB });
    expect(run.delivered_at).not.toBeNull();
  });

  it("sends exactly one report when cron fires twice and the watchdog follows", async () => {
    const { deps: d, sent } = deps();
    await runDailyJob(d, "cron");
    await runDailyJob(d, "cron");
    expect((await runDailyJob(d, "watchdog")).status).toBe("skipped");
    expect(sent).toHaveLength(1);
    expect(sent[0].idempotencyKey).toMatch(/^acq-daily-report\/2026-11-05\/[0-9a-f]{16}$/);
  });

  it("has the watchdog do the whole job if the first cron never fired", async () => {
    const { deps: d, sent, alerts } = deps();
    expect((await runDailyJob(d, "watchdog")).status).toBe("completed");
    expect(sent).toHaveLength(1);
    expect(alerts).toHaveLength(0);
  });

  it("recovers through the watchdog when email fails at first, and doesn't alert", async () => {
    let up = false;
    const { deps: d, alerts } = deps({ sendReport: async () => { if (!up) throw new Error("email down"); } });
    expect((await runDailyJob(d, "cron")).status).toBe("failed");
    up = true;
    expect((await runDailyJob(d, "watchdog")).status).toBe("completed");
    expect(alerts).toHaveLength(0);
  });

  it("alerts when the watchdog can't get the report out either, and doesn't ping the monitor", async () => {
    const ping = vi.fn(async () => {});
    const { deps: d, alerts } = deps({ sendReport: async () => { throw new Error("email down"); }, pingMonitor: ping });
    await runDailyJob(d, "cron");
    expect((await runDailyJob(d, "watchdog")).status).toBe("failed");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].text).toContain("email down");
    expect(ping).not.toHaveBeenCalled();
  });

  it("alerts from the watchdog even when the database is unreachable", async () => {
    const down: Db = { query: async () => { throw new Error("connection refused"); } };
    const { deps: d, alerts } = deps({ db: down });
    expect(await runDailyJob(d, "watchdog")).toMatchObject({ status: "failed", step: "database" });
    expect(alerts[0].text).toContain("connection refused");
  });

  it("survives the alert failing too", async () => {
    const { deps: d } = deps({
      sendReport: async () => { throw new Error("email down"); },
      sendAlert: async () => { throw new Error("still down"); },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await runDailyJob(d, "watchdog")).status).toBe("failed");
    spy.mockRestore();
  });

  it("doesn't fail a delivered run over a monitor outage", async () => {
    const { deps: d, sent } = deps({ pingMonitor: async () => { throw new Error("monitor down"); } });
    expect((await runDailyJob(d, "cron")).status).toBe("completed");
    expect(sent).toHaveLength(1);
  });

  it("reports a failed check if a safety rule was switched off", async () => {
    await db.query(`UPDATE acq_contact_class_rules SET callable = true WHERE contact_class = 'individual_published'`);
    const { deps: d, sent } = deps();
    await runDailyJob(d, "cron");
    expect(sent[0].text).toContain("FAILED Individual contacts");
  });
});

describe("the SuperAdmin's dashboard", () => {
  const person = (role: Admin["role"]): Admin => ({
    id: "00000000-0000-4000-8000-0000000000aa", email: "s@example.com", name: "S", role,
    brandId: role === "superadmin" ? null : BRAND, createdBy: null, mustChangePassword: false, createdAt: "",
  });
  const superadmin = person("superadmin");
  const finishedRun = async () => {
    await runDailyJob({ db, brandId: BRAND, sendEmail: null, now: () => new Date("2026-11-05T03:00:00Z") }, "cron");
    return (await listReports(db, superadmin, BRAND))[0];
  };

  it("shows a finished report even with no email set up", async () => {
    const run = await finishedRun();
    expect(run).toMatchObject({ runDate: "2026-11-05", status: "completed", emailed: false });
    expect(run.report?.subject).toContain("[TEST, no real leads]");
    expect(run.report?.html).toContain("Test run: no real leads");
  });

  it("explains a run that stopped before its report", async () => {
    await db.query(`INSERT INTO acq_runs (brand_id, job, run_date, started_by, status, error) VALUES ($1, $2, '2026-11-04', 'cron', 'failed', 'self_check: boom')`, [BRAND, DAILY_JOB]);
    expect((await listReports(db, superadmin, BRAND))[0]).toMatchObject({ status: "failed", error: "self_check: boom", report: null });
  });

  it("keeps it from every other role, for reading and for changing", async () => {
    for (const role of ["admin", "reviewer"] as const) {
      const other = person(role);
      expect(canViewAcquisition(other)).toBe(false);
      await expect(listReports(db, other, BRAND)).rejects.toThrow("Only the SuperAdmin");
      await expect(listRecipients(db, other, BRAND)).rejects.toThrow("Only the SuperAdmin");
      await expect(addRecipient(db, other, BRAND, "x@example.com")).rejects.toThrow("Only the SuperAdmin");
      await expect(removeRecipient(db, other, BRAND, superadmin.id)).rejects.toThrow("Only the SuperAdmin");
      await expect(sendReportTo(db, other, BRAND, superadmin.id, "x@example.com", async () => {})).rejects.toThrow("Only the SuperAdmin");
    }
  });

  it("lets the SuperAdmin choose recipients, with the change audited", async () => {
    expect(await addRecipient(db, superadmin, BRAND, " Team@Example.com ")).toBe("team@example.com");
    await expect(addRecipient(db, superadmin, BRAND, "team@example.com")).rejects.toThrow("already gets");
    await expect(addRecipient(db, superadmin, BRAND, "not an email")).rejects.toThrow("valid email");
    const [saved] = await listRecipients(db, superadmin, BRAND);
    expect(saved.email).toBe("team@example.com");
    await removeRecipient(db, superadmin, BRAND, saved.id);
    expect(await listRecipients(db, superadmin, BRAND)).toEqual([]);
    const audit = await db.query<{ actor: string; action: string }>(`SELECT actor, action FROM acq_audit_log WHERE record_id = $1 ORDER BY id`, [saved.id]);
    expect(audit.map((row) => row.action)).toEqual(["INSERT", "UPDATE", "DELETE"]);
    expect(audit.at(-1)?.actor).toBe(superadmin.id);
  });

  it("sends one report to any address without changing tomorrow's list", async () => {
    const run = await finishedRun();
    const calls: { key: string; to: string[] }[] = [];
    const send = async (email: Email, to: string[]) => { calls.push({ key: email.idempotencyKey, to }); };
    await sendReportTo(db, superadmin, BRAND, run.id, "partner@example.com", send);
    await sendReportTo(db, superadmin, BRAND, run.id, "partner@example.com", send);
    expect(calls[0].to).toEqual(["partner@example.com"]);
    expect(calls[0].key).not.toBe(calls[1].key);
    expect(await listRecipients(db, superadmin, BRAND)).toEqual([]);
    expect((await one<{ action: string; actor: string }>(`SELECT action, actor FROM acq_audit_log WHERE action = 'SEND_REPORT'`)).actor).toBe(superadmin.id);
  });

  it("says plainly when email can't do it", async () => {
    const run = await finishedRun();
    await expect(sendReportTo(db, superadmin, BRAND, run.id, "a@example.com", null)).rejects.toThrow("isn't set up");
    await expect(sendReportTo(db, superadmin, BRAND, run.id, "a@example.com", async () => { throw new Error("only your own address"); })).rejects.toThrow("only your own address");
  });
});

describe("the report", () => {
  const report = () => buildDailyReport({
    runDate: "2026-11-05", isTest: true, startedAt: new Date("2026-11-05T03:00:00Z"), realLeadCount: 0, leads: SAMPLE_LEADS,
    checks: [{ name: "Database", ok: true, detail: "Connected." }],
  });

  it("can't be mistaken for real leads while in test mode", () => {
    const { subject, text, html } = report();
    expect(subject).toBe("[TEST, no real leads] Daily Acquisition Report: Thursday, 5 November 2026");
    expect(text).toContain("Real leads today: 0");
    expect(text).toContain("Do not call");
    expect(html).toContain("Test run: no real leads");
    expect(text).toContain("06:00 EAT");
  });

  it("contains no phone number or email address", () => {
    const { text, html } = report();
    expect(`${text} ${html}`).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
    expect(`${text} ${html}`).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/);
    expect(SAMPLE_LEADS.every((lead) => /^https:\/\/example\.(com|org)\//.test(lead.sourceUrl))).toBe(true);
  });

  it("escapes what it's given", () => {
    const { html } = buildDailyReport({
      runDate: "2026-11-05", isTest: false, startedAt: new Date(), realLeadCount: 1, checks: [],
      leads: [{ ...SAMPLE_LEADS[0], prospect: "<script>alert(1)</script>" }],
    });
    expect(html).not.toContain("<script>");
  });
});

describe("cron access and configuration", () => {
  it("only accepts the exact secret, and fails closed without one", () => {
    expect(isAuthorizedCron("Bearer right-secret", "right-secret")).toBe(true);
    expect(isAuthorizedCron("Bearer wrong", "right-secret")).toBe(false);
    expect(isAuthorizedCron(null, "right-secret")).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
  });

  it("names what's missing", () => {
    expect(missingConfig({ CRON_SECRET: "x" })).toEqual(["DATABASE_URL"]);
    expect(missingConfig({ CRON_SECRET: "x", DATABASE_URL: "y" })).toEqual([]);
  });

  it("only has an email sender with both a key and a from address", () => {
    expect(emailSender({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(emailSender({ LEAD_EMAIL_FROM: "a@x.co" })).toBeNull();
    expect(emailSender({ RESEND_API_KEY: "re_x", LEAD_EMAIL_FROM: "a@x.co" })).not.toBeNull();
  });

  it("splits recipients and skips the monitor when it isn't set up", async () => {
    expect(recipients(" a@x.co , b@x.co,")).toEqual(["a@x.co", "b@x.co"]);
    expect(monitorPinger(undefined)).toBeUndefined();
    const failing = monitorPinger("https://monitor.example/ping", (async () => new Response("", { status: 500 })) as typeof fetch);
    await expect(failing!()).rejects.toThrow("500");
  });
});

describe("database rules", () => {
  const addProspect = async (key = "p1") => (await one<{ id: string }>(
    `INSERT INTO acq_prospects (brand_id, display_name, prospect_type, category, canonical_key, campaign, score, opening_script)
     VALUES ($1, 'Sample Ltd', 'organisation', 'developer', $2, 'developers', 50, 'Hello') RETURNING id`, [BRAND, key])).id;
  const addSource = async () => (await one<{ id: string }>(
    `INSERT INTO acq_source_records (brand_id, url, outcome, extract) VALUES ($1, 'https://approved.example/a', 'stored', 'text') RETURNING id`, [BRAND])).id;
  const addEvidence = async (prospect: string) => db.query(
    `INSERT INTO acq_evidence (brand_id, prospect_id, claim_type, quote, source_record_id) VALUES ($1, $2, 'active_marketing', 'Now selling', $3)`, [BRAND, prospect, await addSource()]);
  const addContact = async (prospect: string, contactClass = "owner_submitted", hash = "hash-1") => db.query(
    `INSERT INTO acq_contacts (brand_id, prospect_id, kind, normalised_value, value_hash, contact_class, source_record_id)
     VALUES ($1, $2, 'phone', $3, $4, $5, $6)`, [BRAND, prospect, `+2547000${hash}`, hash, contactClass, await addSource()]);
  const setStatus = (id: string, status: string) => db.query(`UPDATE acq_prospects SET status = $2 WHERE id = $1`, [id, status]);
  const approve = (id: string) => db.query(`UPDATE acq_prospects SET approved_at = now(), approved_by = (SELECT id FROM admins LIMIT 1) WHERE id = $1`, [id]);

  let adminId: string;
  beforeAll(async () => {
    adminId = (await one<{ id: string }>(
      `INSERT INTO admins (email, name, role, password_hash, brand_id) VALUES ('a@example.com', 'A', 'admin', 'x', $1) RETURNING id`, [BRAND])).id;
    await db.query(`INSERT INTO admins (email, name, role, password_hash, brand_id) VALUES ('b@example.com', 'B', 'admin', 'x', $1)`, [BRAND]);
  });

  it("makes every prospect start as new and rejects duplicates", async () => {
    await expect(db.query(`INSERT INTO acq_prospects (brand_id, display_name, prospect_type, category, canonical_key, status) VALUES ($1, 'x', 'person', 'developer', 'k', 'ready_to_call')`, [BRAND])).rejects.toThrow("must start as new");
    await addProspect("same");
    await expect(addProspect("same")).rejects.toThrow(/unique/i);
  });

  it("needs evidence before Researched", async () => {
    const id = await addProspect();
    await expect(setStatus(id, "researched")).rejects.toThrow("evidence");
    await addEvidence(id);
    await setStatus(id, "researched");
  });

  it("can't skip the human approval on the way to Ready to Call", async () => {
    const id = await addProspect();
    await addEvidence(id);
    await addContact(id);
    await setStatus(id, "researched");
    await expect(setStatus(id, "ready_to_call")).rejects.toThrow("must approve");
    await approve(id);
    await setStatus(id, "ready_to_call");
  });

  it("can't jump straight from New to Ready to Call", async () => {
    const id = await addProspect();
    await expect(setStatus(id, "ready_to_call")).rejects.toThrow("cannot move");
  });

  it("keeps individuals' published numbers uncallable until the class is cleared", async () => {
    const id = await addProspect();
    await addEvidence(id);
    await addContact(id, "individual_published");
    await setStatus(id, "researched");
    await approve(id);
    await expect(setStatus(id, "ready_to_call")).rejects.toThrow("no contact that may be called");
    await db.query(`UPDATE acq_contact_class_rules SET callable = true WHERE contact_class = 'individual_published'`);
    await setStatus(id, "ready_to_call");
  });

  it("blocks a suppressed contact, and an open duplicate", async () => {
    const suppressed = await addProspect("s");
    await addEvidence(suppressed);
    await addContact(suppressed, "owner_submitted", "hash-2");
    await db.query(`INSERT INTO acq_suppression (value_hash) VALUES ('hash-2')`);
    await setStatus(suppressed, "researched");
    await approve(suppressed);
    await expect(setStatus(suppressed, "ready_to_call")).rejects.toThrow("suppression");

    const duplicate = await addProspect("d");
    const other = await addProspect("o");
    await addEvidence(duplicate);
    await addContact(duplicate, "owner_submitted", "hash-3");
    await db.query(`INSERT INTO acq_duplicate_candidates (brand_id, prospect_id, possible_match_id, reason) VALUES ($1, $2, $3, 'similar name')`, [BRAND, duplicate, other]);
    await setStatus(duplicate, "researched");
    await approve(duplicate);
    await expect(setStatus(duplicate, "ready_to_call")).rejects.toThrow("duplicate");
  });

  it("needs a logged interaction before Contacted, and a date before Follow Up", async () => {
    const id = await addProspect();
    await addEvidence(id);
    await addContact(id);
    await setStatus(id, "researched");
    await approve(id);
    await setStatus(id, "ready_to_call");
    await expect(setStatus(id, "contacted")).rejects.toThrow("logged interaction");
    await expect(setStatus(id, "follow_up")).rejects.toThrow("needs a date");
    await db.query(`INSERT INTO acq_interactions (brand_id, prospect_id, outcome) VALUES ($1, $2, 'answered')`, [BRAND, id]);
    await setStatus(id, "contacted");
  });

  it("writes suppression when someone opts out, from any status, and can't be undone", async () => {
    const id = await addProspect();
    await addContact(id, "owner_submitted", "hash-4");
    await db.query(`UPDATE acq_prospects SET status = 'do_not_contact', updated_by = 'caller-1' WHERE id = $1`, [id]);
    expect(await one<{ value_hash: string; updated_by: string }>(`SELECT value_hash, updated_by FROM acq_suppression`)).toEqual({ value_hash: "hash-4", updated_by: "caller-1" });
    expect((await one<{ usable: boolean }>(`SELECT usable FROM acq_contacts`)).usable).toBe(false);
    await expect(setStatus(id, "new")).rejects.toThrow("cannot change status");
  });

  it("stops an unverified advertiser being recorded as a verified owner", async () => {
    const id = await addProspect();
    await expect(db.query(`UPDATE acq_prospects SET owner_rep_class = 'verified_owner' WHERE id = $1`, [id])).rejects.toThrow(/verified_owner/);
    await expect(db.query(`UPDATE acq_prospects SET authority_status = 'verified' WHERE id = $1`, [id])).rejects.toThrow(/verified_by/);
    await db.query(`UPDATE acq_prospects SET authority_status = 'verified', authority_verified_by = $2, owner_rep_class = 'verified_owner' WHERE id = $1`, [id, adminId]);
  });

  it("requires a source for every contact and piece of evidence", async () => {
    const id = await addProspect();
    await expect(db.query(`INSERT INTO acq_evidence (brand_id, prospect_id, claim_type, quote) VALUES ($1, $2, 'contact', 'x')`, [BRAND, id])).rejects.toThrow(/source_record_id/);
    await expect(db.query(`INSERT INTO acq_contacts (brand_id, prospect_id, kind, normalised_value, value_hash, contact_class) VALUES ($1, $2, 'phone', '1', 'h', 'owner_submitted')`, [BRAND, id])).rejects.toThrow(/source_record_id/);
  });

  describe("the audit log", () => {
    it("records changes without names or contact details", async () => {
      const id = await addProspect();
      await addContact(id, "owner_submitted", "hash-5");
      await db.query(`UPDATE acq_prospects SET score = 60, updated_by = 'admin-1' WHERE id = $1`, [id]);
      const rows = await db.query<{ actor: string; before: { score: number }; after: { score: number } }>(
        `SELECT actor, before, after FROM acq_audit_log WHERE table_name = 'acq_prospects' AND action = 'UPDATE' AND record_id = $1`, [id]);
      expect(rows[0]).toMatchObject({ actor: "admin-1", before: { score: 50 }, after: { score: 60 } });
      const everything = JSON.stringify(await db.query(`SELECT before, after FROM acq_audit_log WHERE record_id = $1 OR table_name = 'acq_contacts'`, [id]));
      expect(everything).not.toContain("Sample Ltd");
      expect(everything).not.toContain("hash-5");
    });

    it("can't be changed or deleted", async () => {
      await db.query(`UPDATE acq_contact_class_rules SET notes = 'x' WHERE contact_class = 'owner_submitted'`);
      await expect(db.query(`UPDATE acq_audit_log SET actor = 'x'`)).rejects.toThrow("append-only");
      await expect(db.query(`DELETE FROM acq_audit_log`)).rejects.toThrow("append-only");
    });
  });

  it("keeps interactions append-only unless erasure is deliberately switched on", async () => {
    const id = await addProspect();
    await db.query(`INSERT INTO acq_interactions (brand_id, prospect_id, outcome) VALUES ($1, $2, 'answered')`, [BRAND, id]);
    await expect(db.query(`UPDATE acq_interactions SET notes = 'x'`)).rejects.toThrow("append-only");
    await expect(db.query(`DELETE FROM acq_prospects WHERE id = $1`, [id])).rejects.toThrow("append-only");
    await pg.exec(`BEGIN; SET LOCAL acq.erasure = 'on'; DELETE FROM acq_prospects WHERE id = '${id}'; COMMIT;`);
    expect(await db.query(`SELECT 1 FROM acq_prospects WHERE id = $1`, [id])).toHaveLength(0);
  });

  describe("the publication gate", () => {
    const insertProperty = (onboardingId: string | null, reviewStatus: string) => db.query(
      `INSERT INTO properties (slug, title, vertical, status, area, price_amount, price_currency, price_period, review_status, brand_id, acq_onboarding_id)
       VALUES ($1, 'T', 'residential', 'public', 'Karen', 1, 'KES', 'sale', $2, $3, $4)`, [`s-${Math.random()}`, reviewStatus, BRAND, onboardingId]);
    const addOnboarding = async () => (await one<{ id: string }>(`INSERT INTO acq_onboarding (brand_id, prospect_id) VALUES ($1, $2) RETURNING id`, [BRAND, await addProspect(`o-${Math.random()}`)])).id;
    const steps = ["identity_verified_at", "ownership_verified_at", "availability_confirmed_at", "terms_confirmed_at", "authority_signed_at", "photos_authorised_at", "submitted_at", "final_approved_at"];
    const secondAdmin = async () => (await one<{ id: string }>(`SELECT id FROM admins WHERE email = 'b@example.com'`)).id;
    const complete = async (id: string, skip?: string) => {
      const sets = steps.filter((step) => step !== skip).map((step) => `${step} = now()`).join(", ");
      await db.query(`UPDATE acq_onboarding SET ${sets}, verified_by = $2, final_approved_by = $3 WHERE id = $1`, [id, adminId, await secondAdmin()]);
    };

    it("leaves properties added by hand alone", async () => {
      await insertProperty(null, "approved");
    });

    it.each(steps)("blocks approval when %s is missing, for any role", async (missing) => {
      const id = await addOnboarding();
      await complete(id, missing);
      await expect(insertProperty(id, "approved")).rejects.toThrow("onboarding is complete");
    });

    it("blocks approving later what was submitted as pending, then allows it when complete", async () => {
      const id = await addOnboarding();
      await insertProperty(id, "pending");
      await expect(db.query(`UPDATE properties SET review_status = 'approved' WHERE acq_onboarding_id = $1`, [id])).rejects.toThrow("onboarding is complete");
      await complete(id);
      await db.query(`UPDATE properties SET review_status = 'approved' WHERE acq_onboarding_id = $1`, [id]);
    });

    it("needs a second person for the final approval", async () => {
      const id = await addOnboarding();
      await expect(db.query(`UPDATE acq_onboarding SET verified_by = $2, final_approved_by = $2 WHERE id = $1`, [id, adminId])).rejects.toThrow(/two_people/);
    });
  });

  it("applies the schema twice without changing human decisions", async () => {
    await db.query(`UPDATE acq_source_policies SET verdict = 'allowed' WHERE domain = 'jiji.co.ke'`);
    await pg.exec(schema);
    expect((await one<{ verdict: string }>(`SELECT verdict FROM acq_source_policies WHERE domain = 'jiji.co.ke'`)).verdict).toBe("allowed");
    await db.query(`UPDATE acq_source_policies SET verdict = 'blocked' WHERE domain = 'jiji.co.ke'`);
  });
});
