import { createHash } from "node:crypto";

import type { Db } from "@/lib/admin/accounts";

import { checkHostPolicy } from "./policy";
import { buildDailyReport, type Report, type ReportLead } from "./report";
import { nairobiDate, runJob, type RunResult, type Step } from "./runner";
import { SAMPLE_LEADS } from "./sample-leads";
import { isResearchEnabled } from "./settings";

export const DAILY_JOB = "daily-acquisition";

export type Email = { subject: string; html: string; text: string; idempotencyKey: string };
export type SendEmail = (email: Email, to: string[]) => Promise<void>;

export type DailyJobDeps = {
  db: Db;
  brandId: string;
  /** Null until email is set up. The report still appears on the SuperAdmin's dashboard. */
  sendEmail: SendEmail | null;
  /** Settings research still needs. With any missing, switching it on can't do anything yet. */
  researchMissing?: string[];
  /** Extra addresses for failure alerts, used even if the database is what's down. */
  alertTo?: string[];
  /** Tells the outside monitor the report is ready. Optional until the monitor is set up. */
  pingMonitor?: () => Promise<void>;
  now?: () => Date;
};

type Check = { name: string; ok: boolean; detail: string };

export async function reportRecipients(db: Db, brandId: string): Promise<string[]> {
  const rows = await db.query<{ email: string }>(
    `SELECT email FROM acq_report_recipients WHERE brand_id = $1 ORDER BY email`,
    [brandId],
  );
  return rows.map((row) => row.email);
}

const TOP_LEADS = 10;

/** Today's real leads and funnel. Contact details stay out: they live behind the dashboard sign-in. */
async function loadTodaysResearch(db: Db, brandId: string, runDate: string): Promise<{ leads: ReportLead[]; count: number; funnel: { label: string; count: number }[] }> {
  const today = `((p.created_at AT TIME ZONE 'UTC') + interval '3 hours')::date = $2::text::date`;
  const rows = await db.query<{ score: number; name: string; category: string; campaign: string; role: string; authority: string; property: string | null; quote: string; url: string }>(
    `SELECT p.score, p.display_name AS name, p.category, p.campaign, p.owner_rep_class AS role, p.authority_status AS authority,
       (SELECT concat_ws(', ', o.property_type, o.area) FROM acq_opportunities o WHERE o.prospect_id = p.id ORDER BY o.first_seen_at DESC LIMIT 1) AS property,
       e.quote, s.url
     FROM acq_prospects p
     JOIN LATERAL (SELECT quote, source_record_id FROM acq_evidence WHERE prospect_id = p.id ORDER BY created_at LIMIT 1) e ON true
     JOIN acq_source_records s ON s.id = e.source_record_id
     WHERE p.brand_id = $1 AND p.status = 'researched' AND ${today}
     ORDER BY p.score DESC, p.created_at`,
    [brandId, runDate],
  );

  const [{ owners }] = await db.query<{ owners: string }>(
    `SELECT count(*)::text AS owners FROM acq_prospects p WHERE p.brand_id = $1 AND p.canonical_key LIKE 'phone:%' AND ${today}`,
    [brandId, runDate],
  );

  const [stages] = await db.query<Record<"found" | "no_lead" | "people" | "refused" | "qualified" | "domains", string>>(
    `SELECT
       count(*) FILTER (WHERE ((discovered_at AT TIME ZONE 'UTC') + interval '3 hours')::date = $2::text::date)::text AS found,
       count(*) FILTER (WHERE status = 'no_lead' AND ((processed_at AT TIME ZONE 'UTC') + interval '3 hours')::date = $2::text::date)::text AS no_lead,
       count(*) FILTER (WHERE status = 'person_skipped' AND ((processed_at AT TIME ZONE 'UTC') + interval '3 hours')::date = $2::text::date)::text AS people,
       count(*) FILTER (WHERE status IN ('refused', 'stopped', 'failed') AND ((processed_at AT TIME ZONE 'UTC') + interval '3 hours')::date = $2::text::date)::text AS refused,
       count(*) FILTER (WHERE status = 'qualified' AND ((processed_at AT TIME ZONE 'UTC') + interval '3 hours')::date = $2::text::date)::text AS qualified,
       (SELECT count(*) FROM acq_source_policies WHERE brand_id = $1 AND verdict = 'pending')::text AS domains
     FROM acq_candidates WHERE brand_id = $1`,
    [brandId, runDate],
  );

  return {
    count: rows.length,
    leads: rows.slice(0, TOP_LEADS).map((row) => ({
      score: row.score,
      prospect: row.name,
      category: `${row.category}, ${row.campaign}`,
      property: row.property || "Not stated",
      classification: `${row.role}, ${row.authority}`,
      evidence: row.quote,
      sourceUrl: row.url,
    })),
    funnel: [
      { label: "owner form submissions", count: Number(owners) },
      { label: "pages found", count: Number(stages.found) },
      { label: "pages with no lead", count: Number(stages.no_lead) },
      { label: "pages about private individuals, skipped and not kept", count: Number(stages.people) },
      { label: "pages that refused or failed", count: Number(stages.refused) },
      { label: "qualified leads", count: Number(stages.qualified) },
      { label: "domains waiting for your review on the dashboard", count: Number(stages.domains) },
    ],
  };
}

/** Confirms the safety rules are really in force, so a bad schema shows up in the morning report. */
async function runSafetyChecks(db: Db, brandId: string): Promise<Check[]> {
  const portal = await checkHostPolicy(db, brandId, "www.property24.co.ke");
  const [locked] = await db.query<{ callable: boolean }>(
    `SELECT callable FROM acq_contact_class_rules WHERE brand_id = $1 AND contact_class = 'individual_published'`,
    [brandId],
  );
  return [
    { name: "Database", ok: true, detail: "Connected, and today's run was recorded." },
    {
      name: "Source policy gate",
      ok: !portal.allowed,
      detail: portal.allowed ? "A blocked portal was allowed. Stop and check source policies." : "Blocked portals stay blocked.",
    },
    {
      name: "Individual contacts",
      ok: locked?.callable === false,
      detail: locked?.callable === false ? "Still locked, pending legal advice." : "This class is unlocked. Confirm counsel cleared it.",
    },
  ];
}

/**
 * The morning job. The cron and the watchdog both call this: whichever gets there first does
 * the work, a duplicate does nothing, and a later call resumes anything unfinished.
 */
export async function runDailyJob(deps: DailyJobDeps, startedBy: "cron" | "watchdog"): Promise<RunResult> {
  const now = deps.now ?? (() => new Date());
  const runDate = nairobiDate(now());

  const steps: Step[] = [
    {
      name: "self_check",
      run: async () => {
        const researchOn = await isResearchEnabled(deps.db, deps.brandId);
        const missing = deps.researchMissing ?? [];
        const research: Check = {
          name: "Research",
          ok: !researchOn || missing.length === 0,
          detail: !researchOn
            ? "Switched off on the dashboard."
            : missing.length > 0
              ? `Switched on, but can't run until these are set: ${missing.join(", ")}.`
              : "Switched on.",
        };
        return { researchOn, checks: [...(await runSafetyChecks(deps.db, deps.brandId)), research] };
      },
    },
    {
      // Once this step is done the report is on the dashboard, whatever happens to email.
      name: "report",
      run: async (outputs) => {
        const { checks, researchOn } = outputs.self_check as { checks: Check[]; researchOn: boolean };
        const { leads, count, funnel } = await loadTodaysResearch(deps.db, deps.brandId, runDate);
        // Owner submissions are real leads, so they get a real report even with research off.
        if (!researchOn && count === 0) {
          return buildDailyReport({ runDate, isTest: true, startedAt: now(), realLeadCount: 0, leads: SAMPLE_LEADS, checks });
        }
        return buildDailyReport({ runDate, isTest: false, startedAt: now(), realLeadCount: count, leads, checks, funnel });
      },
    },
    {
      name: "deliver",
      run: async (outputs) => {
        const report = outputs.report as Report;
        const to = await reportRecipients(deps.db, deps.brandId);
        if (!deps.sendEmail) return { emailed: false, reason: "email_not_set_up" };
        if (to.length === 0) return { emailed: false, reason: "no_recipients" };

        // Repeating this after a crash sends nothing new. The recipients are part of the key
        // because the email service refuses one key with different contents.
        const list = createHash("sha256").update(to.join(",")).digest("hex").slice(0, 16);
        await deps.sendEmail({ ...report, idempotencyKey: `acq-daily-report/${runDate}/${list}` }, to);
        await deps.db.query(
          `UPDATE acq_runs SET delivered_at = COALESCE(delivered_at, now())
           WHERE brand_id = $1 AND job = $2 AND run_date = $3::text::date`,
          [deps.brandId, DAILY_JOB, runDate],
        );
        return { emailed: true, recipients: to.length };
      },
    },
    {
      // Last, so the monitor only hears from a run that finished its report.
      name: "monitor",
      run: async () => {
        if (!deps.pingMonitor) return { pinged: false };
        try {
          await deps.pingMonitor();
          return { pinged: true };
        } catch (cause) {
          // The report is out, so don't fail the run. A missing ping alerts someone anyway.
          return { pinged: false, error: cause instanceof Error ? cause.message : String(cause) };
        }
      },
    },
  ];

  // A thrown error here means the database itself is unreachable, which still needs an alert.
  const result: RunResult = await runJob(deps.db, { brandId: deps.brandId, job: DAILY_JOB, runDate, startedBy }, steps).catch(
    (cause: unknown) => ({
      status: "failed",
      runId: "",
      attempts: 0,
      step: "database",
      error: cause instanceof Error ? cause.message : String(cause),
    }),
  );

  // The watchdog is the last chance today, so someone needs to hear about it now.
  if (result.status === "failed" && startedBy === "watchdog" && deps.sendEmail) {
    const body = `The ${runDate} acquisition report did not finish. It stopped at "${result.step}": ${result.error}`;
    try {
      const saved = await reportRecipients(deps.db, deps.brandId).catch(() => []);
      const to = deps.alertTo && deps.alertTo.length > 0 ? deps.alertTo : saved;
      if (to.length > 0) {
        await deps.sendEmail(
          {
            subject: `ALERT: acquisition report problem (${runDate})`,
            html: `<p>${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
            text: body,
            idempotencyKey: `acq-daily-alert/${runDate}`,
          },
          to,
        );
      }
    } catch (cause) {
      // Email itself may be what's down. The outside monitor covers that case.
      console.error("Acquisition alert could not be sent:", cause instanceof Error ? cause.message : cause);
    }
  }

  return result;
}
