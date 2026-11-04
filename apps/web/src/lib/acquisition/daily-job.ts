import type { Db } from "@/lib/admin/accounts";

import { checkSourcePolicy } from "./policy";
import { buildDailyReport, SAMPLE_LEADS, type Report } from "./report";
import { nairobiDate, runJob, type RunResult, type Step } from "./runner";

export const DAILY_JOB = "daily-acquisition";

export type Email = { subject: string; html: string; text: string; idempotencyKey: string };

export type DailyJobDeps = {
  db: Db;
  brandId: string;
  sendReport: (email: Email) => Promise<void>;
  sendAlert: (email: Email) => Promise<void>;
  /** Tells the outside monitor the report went out. Optional until the monitor is set up. */
  pingMonitor?: () => Promise<void>;
  now?: () => Date;
};

type Check = { name: string; ok: boolean; detail: string };

/** Confirms the safety rules are really in force, so a bad schema shows up in the morning report. */
async function runSafetyChecks(db: Db, brandId: string): Promise<Check[]> {
  const portal = await checkSourcePolicy(db, brandId, "https://www.property24.co.ke/");
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
      run: async () => ({ checks: await runSafetyChecks(deps.db, deps.brandId) }),
    },
    {
      name: "report",
      run: async (outputs) => {
        const { checks } = outputs.self_check as { checks: Check[] };
        return buildDailyReport({ runDate, isTest: true, startedAt: now(), realLeadCount: 0, leads: SAMPLE_LEADS, checks });
      },
    },
    {
      // The key makes a repeat of this step after a crash send nothing new.
      name: "deliver",
      run: async (outputs) => {
        const report = outputs.report as Report;
        await deps.sendReport({ ...report, idempotencyKey: `acq-daily-report/${runDate}` });
        await deps.db.query(
          `UPDATE acq_runs SET delivered_at = COALESCE(delivered_at, now())
           WHERE brand_id = $1 AND job = $2 AND run_date = $3::text::date`,
          [deps.brandId, DAILY_JOB, runDate],
        );
        return { deliveredAt: now().toISOString() };
      },
    },
    {
      // Last, so the monitor only hears from a run whose report actually went out.
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
  if (result.status === "failed" && startedBy === "watchdog") {
    const body = `The ${runDate} acquisition report did not go out. It stopped at "${result.step}": ${result.error}`;
    try {
      await deps.sendAlert({
        subject: `ALERT: no acquisition report today (${runDate})`,
        html: `<p>${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
        text: body,
        idempotencyKey: `acq-daily-alert/${runDate}`,
      });
    } catch (cause) {
      // Email itself may be what's down. The outside monitor covers that case.
      console.error("Acquisition alert could not be sent:", cause instanceof Error ? cause.message : cause);
    }
  }

  return result;
}
