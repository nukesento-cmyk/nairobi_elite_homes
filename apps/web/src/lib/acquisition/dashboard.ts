import { randomUUID } from "node:crypto";

import { AdminError, emailSchema, isDuplicate, parse, type Admin, type Db } from "@/lib/admin/accounts";

import { DAILY_JOB, type SendEmail } from "./daily-job";
import type { Report } from "./report";

const REPORTS_SHOWN = 30;

export type RunSummary = {
  id: string;
  runDate: string;
  status: "running" | "completed" | "failed";
  attempts: number;
  startedBy: string;
  deliveredAt: string | null;
  error: string | null;
  emailed: boolean;
  /** Null if the run stopped before its report was built. */
  report: Report | null;
};

export type Recipient = { id: string; email: string };

/** Acquisition sits above the brands, so it's the SuperAdmin's alone for now. */
export function canViewAcquisition(actor: Admin): boolean {
  return actor.role === "superadmin";
}

function requireSuperadmin(actor: Admin): void {
  if (!canViewAcquisition(actor)) throw new AdminError("Only the SuperAdmin can do that.");
}

export async function listReports(db: Db, actor: Admin, brandId: string): Promise<RunSummary[]> {
  requireSuperadmin(actor);
  return db.query<RunSummary>(
    `SELECT r.id, r.run_date::text AS "runDate", r.status, r.attempts, r.started_by AS "startedBy",
       r.delivered_at::text AS "deliveredAt", r.error, r.delivered_at IS NOT NULL AS emailed,
       (SELECT e.detail FROM acq_run_events e WHERE e.run_id = r.id AND e.step = 'report' AND e.status = 'completed' ORDER BY e.id DESC LIMIT 1) AS report
     FROM acq_runs r WHERE r.brand_id = $1 AND r.job = $2 ORDER BY r.run_date DESC LIMIT ${REPORTS_SHOWN}`,
    [brandId, DAILY_JOB],
  );
}

export async function listRecipients(db: Db, actor: Admin, brandId: string): Promise<Recipient[]> {
  requireSuperadmin(actor);
  return db.query<Recipient>(`SELECT id, email FROM acq_report_recipients WHERE brand_id = $1 ORDER BY email`, [brandId]);
}

export async function addRecipient(db: Db, actor: Admin, brandId: string, rawEmail: unknown): Promise<string> {
  requireSuperadmin(actor);
  const email = parse(emailSchema, String(rawEmail ?? "").trim());
  try {
    await db.query(`INSERT INTO acq_report_recipients (brand_id, email, updated_by) VALUES ($1, $2, $3)`, [brandId, email, actor.id]);
  } catch (error) {
    if (isDuplicate(error)) throw new AdminError("That address already gets the report.");
    throw error;
  }
  return email;
}

export async function removeRecipient(db: Db, actor: Admin, brandId: string, id: string): Promise<void> {
  requireSuperadmin(actor);
  await db.query(`UPDATE acq_report_recipients SET updated_by = $3 WHERE id = $1 AND brand_id = $2`, [id, brandId, actor.id]);
  await db.query(`DELETE FROM acq_report_recipients WHERE id = $1 AND brand_id = $2`, [id, brandId]);
}

/** Sends one report to one address, without changing who gets tomorrow's. */
export async function sendReportTo(
  db: Db,
  actor: Admin,
  brandId: string,
  runId: string,
  rawEmail: unknown,
  sendEmail: SendEmail | null,
): Promise<string> {
  requireSuperadmin(actor);
  const email = parse(emailSchema, String(rawEmail ?? "").trim());
  if (!sendEmail) throw new AdminError("Email isn't set up yet, so reports can only be read here.");

  const [run] = await db.query<{ report: Report | null }>(
    `SELECT (SELECT e.detail FROM acq_run_events e WHERE e.run_id = r.id AND e.step = 'report' AND e.status = 'completed' ORDER BY e.id DESC LIMIT 1) AS report
     FROM acq_runs r WHERE r.id = $1 AND r.brand_id = $2`,
    [runId, brandId],
  );
  if (!run?.report) throw new AdminError("That report isn't available.");

  try {
    await sendEmail({ ...run.report, idempotencyKey: `acq-manual-report/${randomUUID()}` }, [email]);
  } catch (error) {
    throw new AdminError(`The email service refused it: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  await db.query(
    `INSERT INTO acq_audit_log (actor, action, table_name, record_id, after) VALUES ($1, 'SEND_REPORT', 'acq_runs', $2, $3::text::jsonb)`,
    [actor.id, runId, JSON.stringify({ to: email })],
  );
  return email;
}
