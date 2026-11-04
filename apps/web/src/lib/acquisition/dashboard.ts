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

export async function setResearchEnabled(db: Db, actor: Admin, brandId: string, enabled: boolean): Promise<void> {
  requireSuperadmin(actor);
  await db.query(
    `INSERT INTO acq_settings (brand_id, research_enabled, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (brand_id) DO UPDATE SET research_enabled = EXCLUDED.research_enabled, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [brandId, enabled, actor.id],
  );
}

export type PendingDomain = { id: string; domain: string; pages: number; exampleUrl: string | null; exampleTitle: string | null };

/** Domains discovery found. Nothing is read from one until a person has looked at its terms. */
export async function listPendingDomains(db: Db, actor: Admin, brandId: string): Promise<PendingDomain[]> {
  requireSuperadmin(actor);
  const rows = await db.query<Omit<PendingDomain, "pages"> & { pages: string }>(
    `SELECT p.id, p.domain,
       (SELECT count(*) FROM acq_candidates c WHERE c.brand_id = p.brand_id AND c.domain = p.domain AND c.status = 'queued')::text AS pages,
       (SELECT c.url FROM acq_candidates c WHERE c.brand_id = p.brand_id AND c.domain = p.domain ORDER BY c.discovered_at LIMIT 1) AS "exampleUrl",
       (SELECT c.title FROM acq_candidates c WHERE c.brand_id = p.brand_id AND c.domain = p.domain ORDER BY c.discovered_at LIMIT 1) AS "exampleTitle"
     FROM acq_source_policies p WHERE p.brand_id = $1 AND p.verdict = 'pending' ORDER BY p.created_at LIMIT 100`,
    [brandId],
  );
  return rows.map((row) => ({ ...row, pages: Number(row.pages) }));
}

export async function decideDomain(db: Db, actor: Admin, brandId: string, id: string, verdict: string, termsUrl: unknown): Promise<void> {
  requireSuperadmin(actor);
  if (verdict !== "allowed" && verdict !== "human_only" && verdict !== "blocked") throw new AdminError("Choose allow or block.");
  await db.query(
    `UPDATE acq_source_policies SET verdict = $3, terms_url = COALESCE(NULLIF($4::text, ''), terms_url), reviewed_by = $5::text::uuid, reviewed_at = now(), updated_at = now(), updated_by = $5::text
     WHERE id = $1 AND brand_id = $2`,
    [id, brandId, verdict, String(termsUrl ?? "").trim().slice(0, 500), actor.id],
  );
}

export type LeadRow = {
  id: string;
  name: string;
  category: string;
  campaign: string | null;
  status: string;
  score: number | null;
  scoreBreakdown: Record<string, number>;
  role: string;
  authority: string;
  script: string | null;
  evidence: { claimType: string; quote: string; url: string }[];
  contacts: { kind: string; value: string; contactClass: string; callable: boolean }[];
  property: string | null;
  nextFollowUp: string | null;
  followUpDue: boolean;
  calls: { outcome: string; notes: string | null; at: string }[];
  possibleDuplicates: { name: string; reason: string }[];
};

const LEADS_SHOWN = 50;

export async function listLeads(db: Db, actor: Admin, brandId: string): Promise<LeadRow[]> {
  requireSuperadmin(actor);
  return db.query<LeadRow>(
    `SELECT p.id, p.display_name AS name, p.category, p.campaign, p.status, p.score, p.score_breakdown AS "scoreBreakdown",
       p.owner_rep_class AS role, p.authority_status AS authority, p.opening_script AS script,
       (SELECT concat_ws(', ', o.property_type, o.area) FROM acq_opportunities o WHERE o.prospect_id = p.id ORDER BY o.first_seen_at DESC LIMIT 1) AS property,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('claimType', e.claim_type, 'quote', e.quote, 'url', s.url))
                 FROM acq_evidence e JOIN acq_source_records s ON s.id = e.source_record_id WHERE e.prospect_id = p.id), '[]') AS evidence,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', c.kind, 'value', c.normalised_value, 'contactClass', c.contact_class, 'callable', r.callable AND c.usable))
                 FROM acq_contacts c JOIN acq_contact_class_rules r ON r.brand_id = c.brand_id AND r.contact_class = c.contact_class
                 WHERE c.prospect_id = p.id), '[]') AS contacts,
       ((p.next_follow_up_at AT TIME ZONE 'UTC') + interval '3 hours')::date::text AS "nextFollowUp",
       COALESCE(p.next_follow_up_at <= now(), false) AS "followUpDue",
       COALESCE((SELECT jsonb_agg(row_to_json(i)) FROM (
                   SELECT outcome, notes, ((occurred_at AT TIME ZONE 'UTC') + interval '3 hours')::date::text AS at
                   FROM acq_interactions WHERE prospect_id = p.id ORDER BY occurred_at DESC LIMIT 10) i), '[]') AS calls,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('name', other.display_name, 'reason', d.reason))
                 FROM acq_duplicate_candidates d
                 JOIN acq_prospects other ON other.id = CASE WHEN d.prospect_id = p.id THEN d.possible_match_id ELSE d.prospect_id END
                 WHERE d.status = 'open' AND p.id IN (d.prospect_id, d.possible_match_id)), '[]') AS "possibleDuplicates"
     FROM acq_prospects p
     WHERE p.brand_id = $1 AND p.status IN ('researched', 'ready_to_call', 'contacted', 'interested', 'meeting_scheduled', 'negotiating', 'follow_up')
     ORDER BY COALESCE(p.next_follow_up_at <= now(), false) DESC, p.next_follow_up_at NULLS LAST, p.score DESC NULLS LAST, p.created_at DESC
     LIMIT ${LEADS_SHOWN}`,
    [brandId],
  );
}

/** A person has compared them and says they're different, which clears the block on approving. */
export async function clearPossibleDuplicates(db: Db, actor: Admin, brandId: string, prospectId: string): Promise<void> {
  requireSuperadmin(actor);
  await db.query(
    `UPDATE acq_duplicate_candidates SET status = 'not_duplicate', resolved_by = $3, resolved_at = now()
     WHERE brand_id = $1 AND status = 'open' AND $2::text::uuid IN (prospect_id, possible_match_id)`,
    [brandId, prospectId, actor.id],
  );
}

export async function countDoNotContact(db: Db, actor: Admin): Promise<number> {
  requireSuperadmin(actor);
  const [row] = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM acq_suppression`);
  return Number(row.count);
}

/** The database decides if this is allowed, and its reason is what the person sees. */
export async function approveLead(db: Db, actor: Admin, brandId: string, id: string): Promise<void> {
  requireSuperadmin(actor);
  try {
    await db.query(
      `UPDATE acq_prospects SET status = 'ready_to_call', approved_by = $3::text::uuid, approved_at = now(), updated_by = $3::text WHERE id = $1 AND brand_id = $2`,
      [id, brandId, actor.id],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "P0001") throw new AdminError((error as Error).message);
    throw error;
  }
}

export async function rejectLead(db: Db, actor: Admin, brandId: string, id: string): Promise<void> {
  requireSuperadmin(actor);
  await db.query(`UPDATE acq_prospects SET status = 'rejected', updated_by = $3 WHERE id = $1 AND brand_id = $2 AND status = 'researched'`, [id, brandId, actor.id]);
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
