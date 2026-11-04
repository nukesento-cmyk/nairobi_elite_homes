import type { Db } from "@/lib/admin/accounts";

/** Longer than a function can run, so a crashed attempt's lease has always expired by the next trigger. */
const LEASE_MINUTES = 10;

export type RunIdentity = { brandId: string; job: string; runDate: string; startedBy: string };

export type Step = {
  name: string;
  /** Receives what the earlier steps returned. May run more than once if a later attempt resumes here. */
  run: (outputs: Record<string, unknown>) => Promise<unknown>;
};

export type RunResult =
  | { status: "completed"; runId: string; attempts: number }
  | { status: "failed"; runId: string; attempts: number; step: string; error: string }
  | { status: "skipped"; reason: "already_completed" | "already_running" };

/** Today's date in Nairobi. Kenya has no daylight saving, so this never shifts. */
export function nairobiDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Takes today's run, or returns null if there's nothing to do. The unique key settles a race
 * between two calls. A run that failed or whose lease expired can be taken over and resumed.
 */
async function claimRun(db: Db, run: RunIdentity): Promise<{ id: string; attempts: number } | { skipped: "already_completed" | "already_running" }> {
  const [created] = await db.query<{ id: string; attempts: number }>(
    `INSERT INTO acq_runs (brand_id, job, run_date, started_by, lease_expires_at)
     VALUES ($1, $2, $3::text::date, $4, now() + interval '${LEASE_MINUTES} minutes')
     ON CONFLICT (brand_id, job, run_date) DO NOTHING
     RETURNING id, attempts`,
    [run.brandId, run.job, run.runDate, run.startedBy],
  );
  if (created) return created;

  const [taken] = await db.query<{ id: string; attempts: number }>(
    `UPDATE acq_runs SET status = 'running', attempts = attempts + 1, error = NULL,
       lease_expires_at = now() + interval '${LEASE_MINUTES} minutes'
     WHERE brand_id = $1 AND job = $2 AND run_date = $3::text::date AND status <> 'completed'
       AND (status = 'failed' OR lease_expires_at IS NULL OR lease_expires_at < now())
     RETURNING id, attempts`,
    [run.brandId, run.job, run.runDate],
  );
  if (taken) return taken;

  const [existing] = await db.query<{ status: string }>(
    `SELECT status FROM acq_runs WHERE brand_id = $1 AND job = $2 AND run_date = $3::text::date`,
    [run.brandId, run.job, run.runDate],
  );
  return { skipped: existing?.status === "completed" ? "already_completed" : "already_running" };
}

async function logEvent(db: Db, runId: string, step: string, status: "started" | "completed" | "failed", detail: unknown = {}): Promise<void> {
  await db.query(
    `INSERT INTO acq_run_events (run_id, step, status, detail) VALUES ($1, $2, $3, $4::text::jsonb)`,
    [runId, step, status, JSON.stringify(detail ?? {})],
  );
}

/**
 * Runs the steps in order, recording each. A later attempt skips what already finished and
 * carries on from the step that didn't, so a crash or outage never repeats finished work.
 */
export async function runJob(db: Db, identity: RunIdentity, steps: Step[]): Promise<RunResult> {
  const claim = await claimRun(db, identity);
  if ("skipped" in claim) return { status: "skipped", reason: claim.skipped };

  const done = await db.query<{ step: string; detail: unknown }>(
    `SELECT step, detail FROM acq_run_events WHERE run_id = $1 AND status = 'completed' ORDER BY id`,
    [claim.id],
  );
  const outputs: Record<string, unknown> = Object.fromEntries(done.map((row) => [row.step, row.detail]));

  for (const step of steps) {
    if (step.name in outputs) continue;

    await logEvent(db, claim.id, step.name, "started");
    try {
      outputs[step.name] = (await step.run(outputs)) ?? {};
      await logEvent(db, claim.id, step.name, "completed", outputs[step.name]);
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      await logEvent(db, claim.id, step.name, "failed", { error });
      await db.query(
        `UPDATE acq_runs SET status = 'failed', error = $2, lease_expires_at = NULL WHERE id = $1`,
        [claim.id, `${step.name}: ${error}`],
      );
      return { status: "failed", runId: claim.id, attempts: claim.attempts, step: step.name, error };
    }
  }

  await db.query(
    `UPDATE acq_runs SET status = 'completed', completed_at = now(), lease_expires_at = NULL WHERE id = $1`,
    [claim.id],
  );
  return { status: "completed", runId: claim.id, attempts: claim.attempts };
}
