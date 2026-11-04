import { z } from "zod";

import { AdminError, canWorkLeads, parse, type Admin, type Db } from "@/lib/admin/accounts";

import { hashContact } from "./research";
import { normaliseEmail, normalisePhone } from "./verify";

/** A real conversation, where the caller must have told them they can opt out. */
const NEEDS_OPT_OUT_LINE = ["answered", "interested", "meeting_booked", "not_interested"];
const CAN_BE_CALLED = ["ready_to_call", "contacted", "interested", "meeting_scheduled", "negotiating", "follow_up"];

const callSchema = z.object({
  outcome: z.enum(["no_answer", "answered", "interested", "meeting_booked", "not_interested", "wrong_person", "opt_out"], "Choose what happened."),
  notes: z.string().trim().max(2000, "Please keep notes under 2,000 characters."),
  optOutLineRead: z.boolean(),
  nextFollowUp: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")]),
});

export type CallInput = { outcome: unknown; notes: unknown; optOutLineRead: unknown; nextFollowUp: unknown };

function requireLeadAccess(actor: Admin, brandId: string): void {
  if (!canWorkLeads(actor, brandId)) throw new AdminError("You don't have access to leads.");
}

/** Marks a prospect Do Not Contact. The database suppresses every contact they have in the same step. */
export async function markDoNotContact(db: Db, actor: Admin, brandId: string, prospectId: string): Promise<void> {
  requireLeadAccess(actor, brandId);
  await db.query(`UPDATE acq_prospects SET status = 'do_not_contact', next_follow_up_at = NULL, updated_by = $3 WHERE id = $1 AND brand_id = $2`, [prospectId, brandId, actor.id]);
}

const STAGES = ["ready_to_call", "contacted", "interested", "meeting_scheduled", "negotiating"];

/** The stage a call leads to, or null if it leaves the stage alone. */
function stageAfter(outcome: string): string | null {
  if (outcome === "answered") return "contacted";
  if (outcome === "interested") return "interested";
  if (outcome === "meeting_booked") return "meeting_scheduled";
  return null;
}

/**
 * Records a call and moves the prospect on. An opt-out is applied before anything else, so it
 * takes effect even if something later fails. A call never moves someone backwards.
 */
export async function logCall(db: Db, actor: Admin, brandId: string, prospectId: string, raw: CallInput, today: string): Promise<string> {
  requireLeadAccess(actor, brandId);
  const input = parse(callSchema, {
    outcome: raw.outcome,
    notes: String(raw.notes ?? ""),
    optOutLineRead: raw.optOutLineRead === true,
    nextFollowUp: String(raw.nextFollowUp ?? ""),
  });

  const [prospect] = await db.query<{ status: string }>(`SELECT status FROM acq_prospects WHERE id = $1 AND brand_id = $2`, [prospectId, brandId]);
  if (!prospect) throw new AdminError("That lead no longer exists.");
  if (prospect.status === "do_not_contact") throw new AdminError("This person asked not to be contacted.");
  if (!CAN_BE_CALLED.includes(prospect.status)) throw new AdminError("Approve this lead before logging a call.");

  if (NEEDS_OPT_OUT_LINE.includes(input.outcome) && !input.optOutLineRead) {
    throw new AdminError("Tell them they can opt out, then tick the box. The law requires it on marketing calls.");
  }
  if (input.nextFollowUp && input.nextFollowUp < today) throw new AdminError("The follow-up date has to be today or later.");
  const closes = input.outcome === "opt_out" || input.outcome === "not_interested";
  if (input.nextFollowUp && closes) throw new AdminError("Don't set a follow-up for someone who said no.");

  if (input.outcome === "opt_out") await markDoNotContact(db, actor, brandId, prospectId);

  // 09:00 in Nairobi on the chosen day.
  const followUpAt = input.nextFollowUp ? `${input.nextFollowUp}T06:00:00Z` : null;
  await db.query(
    `INSERT INTO acq_interactions (brand_id, prospect_id, caller_id, channel, outcome, opt_out_line_read, notes, next_follow_up_at)
     VALUES ($1, $2, $3, 'call', $4, $5, $6, $7::text::timestamptz)`,
    [brandId, prospectId, actor.id, input.outcome, input.optOutLineRead, input.notes || null, followUpAt],
  );
  if (input.outcome === "opt_out") return "Logged. They're on the Do Not Contact list, and won't be contacted again.";

  const move = (status: string) =>
    db.query(`UPDATE acq_prospects SET status = $3, updated_by = $4 WHERE id = $1 AND brand_id = $2`, [prospectId, brandId, status, actor.id]);

  if (input.outcome === "not_interested") {
    await db.query(`UPDATE acq_prospects SET status = 'rejected', next_follow_up_at = NULL, updated_by = $3 WHERE id = $1 AND brand_id = $2`, [prospectId, brandId, actor.id]);
    return "Logged, and closed as not interested.";
  }

  const target = stageAfter(input.outcome);
  let current = prospect.status;
  if (target) {
    if (current === "follow_up") {
      await move(target);
      current = target;
    } else {
      // Stages move one at a time, so a first call that books a meeting passes through each.
      for (const stage of STAGES.slice(STAGES.indexOf(current) + 1, STAGES.indexOf(target) + 1)) {
        await move(stage);
        current = stage;
      }
    }
  }

  if (followUpAt) {
    await db.query(
      `UPDATE acq_prospects SET status = 'follow_up', next_follow_up_at = $3::text::timestamptz, updated_by = $4 WHERE id = $1 AND brand_id = $2`,
      [prospectId, brandId, followUpAt, actor.id],
    );
    return `Logged. Follow up on ${input.nextFollowUp}.`;
  }
  // A follow-up that's been dealt with shouldn't keep showing as due, unless nobody answered.
  if (input.outcome !== "no_answer" && input.outcome !== "wrong_person") {
    await db.query(`UPDATE acq_prospects SET next_follow_up_at = NULL WHERE id = $1 AND brand_id = $2`, [prospectId, brandId]);
  }
  return "Logged.";
}

/**
 * For someone who opts out without being on a call, by phone, message or email. It works whether
 * or not they're a lead, and any lead holding that contact becomes Do Not Contact.
 */
export async function suppressContact(db: Db, actor: Admin, brandId: string, hashKey: string | undefined, rawContact: unknown): Promise<void> {
  requireLeadAccess(actor, brandId);
  if (!hashKey) throw new AdminError("The opt-out list isn't set up: ACQUISITION_HASH_KEY is missing.");

  const text = String(rawContact ?? "").trim();
  const email = text.includes("@") ? normaliseEmail(text) : null;
  const phone = text.includes("@") ? null : normalisePhone(text);
  if (!email && !phone) throw new AdminError("Enter a Kenyan phone number or an email address.");
  const hash = email ? hashContact(hashKey, "email", email) : hashContact(hashKey, "phone", phone!);

  await db.query(
    `INSERT INTO acq_suppression (value_hash, origin_brand_id, updated_by) VALUES ($1, $2, $3) ON CONFLICT (value_hash) DO NOTHING`,
    [hash, brandId, actor.id],
  );
  const holders = await db.query<{ prospect_id: string }>(
    `SELECT DISTINCT c.prospect_id FROM acq_contacts c JOIN acq_prospects p ON p.id = c.prospect_id
     WHERE c.value_hash = $1 AND p.status <> 'do_not_contact'`,
    [hash],
  );
  for (const holder of holders) {
    await db.query(`UPDATE acq_prospects SET status = 'do_not_contact', next_follow_up_at = NULL, updated_by = $2 WHERE id = $1`, [holder.prospect_id, actor.id]);
  }
}
