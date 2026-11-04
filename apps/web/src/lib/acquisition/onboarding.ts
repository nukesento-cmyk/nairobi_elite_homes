import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

import { z } from "zod";

import { AdminError, type Admin, type Db } from "@/lib/admin/accounts";
import { createOnboardedProperty } from "@/lib/content";

import { MAX_DOCUMENT_BYTES, OWNER_DOCUMENT_TYPES, type DocumentType, type OnboardingStep } from "./onboarding-types";

const LINK_DAYS = 7;
const MAX_DOCUMENTS = 25;
/** For counsel to confirm. ID and ownership papers go soon after they've been checked. */
const KEEP_DAYS: Record<DocumentType, number> = { identity: 90, ownership: 90, authority: 90, other: 90, marketing_authority: 1095 };
const ONBOARDING_STATUSES = ["interested", "meeting_scheduled", "negotiating", "follow_up"];

/** The private file store. Passed in, so this logic can be tested without one. */
export type DocumentStore = {
  put(pathname: string, bytes: Buffer): Promise<string>;
  get(ref: string): Promise<Buffer | null>;
  del(ref: string): Promise<void>;
};

export type DocumentDeps = { db: Db; store: DocumentStore; key: string };

function requireSuperadmin(actor: Admin): void {
  if (actor.role !== "superadmin") throw new AdminError("Only the SuperAdmin can do that.");
}

function keyBytes(key: string): Buffer {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32) throw new Error("ACQUISITION_DOCUMENT_KEY must be 32 bytes, base64 encoded.");
  return bytes;
}

/** AES-256-GCM, with the document's id bound in, so a stored file can't be swapped for another. */
export function encryptDocument(key: string, documentId: string, plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  cipher.setAAD(Buffer.from(documentId));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decryptDocument(key: string, documentId: string, sealed: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), sealed.subarray(0, 12));
  decipher.setAAD(Buffer.from(documentId));
  decipher.setAuthTag(sealed.subarray(12, 28));
  return Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]);
}

/** What a file really is, from its first bytes. What a browser claims is never trusted. */
export function sniffDocumentType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startOnboarding(db: Db, actor: Admin, brandId: string, prospectId: string): Promise<string> {
  requireSuperadmin(actor);
  const [prospect] = await db.query<{ status: string }>(`SELECT status FROM acq_prospects WHERE id = $1 AND brand_id = $2`, [prospectId, brandId]);
  if (!prospect) throw new AdminError("That lead no longer exists.");
  if (!ONBOARDING_STATUSES.includes(prospect.status)) throw new AdminError("Onboarding starts once they've expressed interest. Log that call first.");
  try {
    const [row] = await db.query<{ id: string }>(`INSERT INTO acq_onboarding (brand_id, prospect_id, updated_by) VALUES ($1, $2, $3) RETURNING id`, [brandId, prospectId, actor.id]);
    return row.id;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw new AdminError("This lead is already being onboarded.");
    throw error;
  }
}

/** The link's secret is shown once and never stored. Issuing a new one cancels the last. */
export async function issueUploadLink(db: Db, actor: Admin, brandId: string, onboardingId: string): Promise<string> {
  requireSuperadmin(actor);
  await requireOpen(db, brandId, onboardingId);
  await db.query(`UPDATE acq_onboarding_links SET revoked_at = now() WHERE onboarding_id = $1 AND revoked_at IS NULL`, [onboardingId]);
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO acq_onboarding_links (onboarding_id, token_hash, expires_at, created_by) VALUES ($1, $2, now() + interval '${LINK_DAYS} days', $3)`,
    [onboardingId, hashToken(token), actor.id],
  );
  return token;
}

/** Saves a file sent through an owner's link. A wrong, expired or closed link gets the same answer. */
export async function saveDocumentFromLink(deps: DocumentDeps, token: string, docType: unknown, bytes: Buffer): Promise<void> {
  const { db } = deps;
  const [link] = await db.query<{ onboarding_id: string; brand_id: string }>(
    `SELECT l.onboarding_id, o.brand_id FROM acq_onboarding_links l JOIN acq_onboarding o ON o.id = l.onboarding_id
     WHERE l.token_hash = $1 AND l.revoked_at IS NULL AND l.expires_at > now() AND o.failed_reason IS NULL AND o.submitted_at IS NULL`,
    [hashToken(token)],
  );
  if (!link) throw new AdminError("This link has expired. Please ask us for a new one.");
  await storeDocument(deps, link.brand_id, link.onboarding_id, docType, bytes);
}

async function storeDocument(deps: DocumentDeps, brandId: string, onboardingId: string, docType: unknown, bytes: Buffer): Promise<void> {
  const { db, store, key } = deps;
  const type = OWNER_DOCUMENT_TYPES.find((item) => item.value === docType)?.value;
  if (!type) throw new AdminError("Choose what kind of document this is.");
  if (bytes.length === 0) throw new AdminError("Choose a file.");
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new AdminError("Files can be up to 4 MB. Please send a smaller one.");
  const contentType = sniffDocumentType(bytes);
  if (!contentType) throw new AdminError("Please send a PDF, JPG, PNG or WebP file.");

  const [count] = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM acq_onboarding_documents WHERE onboarding_id = $1`, [onboardingId]);
  if (Number(count.count) >= MAX_DOCUMENTS) throw new AdminError("That's as many files as we can take here. Please contact us.");

  const id = randomUUID();
  const ref = await store.put(`onboarding/${onboardingId}/${id}`, encryptDocument(key, id, bytes));
  await db.query(
    `INSERT INTO acq_onboarding_documents (id, brand_id, onboarding_id, doc_type, storage_ref, delete_after, content_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, (now() + ($6::int * interval '1 day'))::date, $7, $8)`,
    [id, brandId, onboardingId, type, ref, KEEP_DAYS[type], contentType, bytes.length],
  );
}

/** Staff can add a document they received another way, such as a signed authority. */
export async function saveDocumentAsStaff(deps: DocumentDeps, actor: Admin, brandId: string, onboardingId: string, docType: unknown, bytes: Buffer): Promise<void> {
  requireSuperadmin(actor);
  await requireOpen(deps.db, brandId, onboardingId);
  await storeDocument(deps, brandId, onboardingId, docType, bytes);
}

/** Opens a document for the SuperAdmin. Each look is logged, without the document's contents. */
export async function readDocument(deps: DocumentDeps, actor: Admin, brandId: string, documentId: string): Promise<{ bytes: Buffer; contentType: string; docType: string } | null> {
  requireSuperadmin(actor);
  if (!z.uuid().safeParse(documentId).success) return null;
  const [doc] = await deps.db.query<{ storage_ref: string; content_type: string; doc_type: string }>(
    `SELECT storage_ref, content_type, doc_type FROM acq_onboarding_documents WHERE id = $1 AND brand_id = $2`,
    [documentId, brandId],
  );
  if (!doc) return null;
  const sealed = await deps.store.get(doc.storage_ref);
  if (!sealed) return null;
  await deps.db.query(`INSERT INTO acq_audit_log (actor, action, table_name, record_id) VALUES ($1, 'VIEW_DOCUMENT', 'acq_onboarding_documents', $2)`, [actor.id, documentId]);
  return { bytes: decryptDocument(deps.key, documentId, sealed), contentType: doc.content_type, docType: doc.doc_type };
}

export async function verifyDocument(db: Db, actor: Admin, brandId: string, documentId: string): Promise<void> {
  requireSuperadmin(actor);
  await db.query(`UPDATE acq_onboarding_documents SET verified_by = $3, verified_at = now() WHERE id = $1 AND brand_id = $2`, [documentId, brandId, actor.id]);
  await db.query(`INSERT INTO acq_audit_log (actor, action, table_name, record_id) VALUES ($1, 'VERIFY_DOCUMENT', 'acq_onboarding_documents', $2)`, [actor.id, documentId]);
}

async function deleteDocumentRow(deps: DocumentDeps, documentId: string, ref: string): Promise<void> {
  // The file goes first: a row left behind can be retried, but a lost row would orphan the file.
  await deps.store.del(ref);
  await deps.db.query(`DELETE FROM acq_onboarding_documents WHERE id = $1`, [documentId]);
}

export async function removeDocument(deps: DocumentDeps, actor: Admin, brandId: string, documentId: string): Promise<void> {
  requireSuperadmin(actor);
  const [doc] = await deps.db.query<{ storage_ref: string }>(`SELECT storage_ref FROM acq_onboarding_documents WHERE id = $1 AND brand_id = $2`, [documentId, brandId]);
  if (!doc) return;
  await deleteDocumentRow(deps, documentId, doc.storage_ref);
  await deps.db.query(`INSERT INTO acq_audit_log (actor, action, table_name, record_id) VALUES ($1, 'DELETE_DOCUMENT', 'acq_onboarding_documents', $2)`, [actor.id, documentId]);
}

/** Stores, reads back and deletes a throwaway file, proving storage and encryption really work. */
export async function probeDocumentStore({ store, key }: Omit<DocumentDeps, "db">): Promise<void> {
  const id = randomUUID();
  const plain = randomBytes(32);
  const ref = await store.put(`health-check/${id}`, encryptDocument(key, id, plain));
  try {
    const back = await store.get(ref);
    if (!back || !decryptDocument(key, id, back).equals(plain)) throw new Error("The file read back didn't match.");
  } finally {
    await store.del(ref);
  }
}

/** Deletes documents past their keep-until date. One failure doesn't stop the rest. */
export async function purgeExpiredDocuments(deps: DocumentDeps): Promise<{ deleted: number; failed: number }> {
  const due = await deps.db.query<{ id: string; storage_ref: string }>(`SELECT id, storage_ref FROM acq_onboarding_documents WHERE delete_after < now()::date LIMIT 200`);
  let deleted = 0;
  let failed = 0;
  for (const doc of due) {
    try {
      await deleteDocumentRow(deps, doc.id, doc.storage_ref);
      await deps.db.query(`INSERT INTO acq_audit_log (actor, action, table_name, record_id) VALUES ('retention', 'DELETE_DOCUMENT', 'acq_onboarding_documents', $1)`, [doc.id]);
      deleted += 1;
    } catch {
      failed += 1;
    }
  }
  return { deleted, failed };
}

type OnboardingRow = {
  id: string; prospect_id: string; identity_verified_at: string | null; ownership_verified_at: string | null;
  availability_confirmed_at: string | null; terms_confirmed_at: string | null; authority_signed_at: string | null;
  agreed_amount: string | null; agreed_currency: string | null; agreed_period: string | null; failed_reason: string | null; submitted_at: string | null;
};

async function requireOpen(db: Db, brandId: string, id: string): Promise<OnboardingRow> {
  const [row] = await db.query<OnboardingRow>(`SELECT * FROM acq_onboarding WHERE id = $1 AND brand_id = $2`, [id, brandId]);
  if (!row) throw new AdminError("That onboarding no longer exists.");
  if (row.failed_reason) throw new AdminError("This onboarding was stopped.");
  if (row.submitted_at) throw new AdminError("This has already been submitted for approval.");
  return row;
}

async function hasVerified(db: Db, id: string, types: DocumentType[]): Promise<boolean> {
  const placeholders = types.map((_, i) => `$${i + 2}`).join(", ");
  const rows = await db.query(`SELECT 1 FROM acq_onboarding_documents WHERE onboarding_id = $1 AND verified_at IS NOT NULL AND doc_type IN (${placeholders}) LIMIT 1`, [id, ...types]);
  return rows.length > 0;
}

const termsSchema = z.object({
  amount: z.coerce.number("Enter the agreed price.").positive("Enter the agreed price."),
  currency: z.enum(["KES", "USD"], "Choose a currency."),
  period: z.enum(["sale", "month"], "Choose sale or monthly rent."),
  terms: z.string().trim().min(3, "Write down the agreed marketing terms.").max(2000),
});

/** Ticks one step of the checklist. Each needs its proof, and the steps that matter go in order. */
export async function confirmStep(db: Db, actor: Admin, brandId: string, id: string, step: OnboardingStep, input: Record<string, unknown> = {}): Promise<void> {
  requireSuperadmin(actor);
  const row = await requireOpen(db, brandId, id);

  if (step === "identity") {
    if (!(await hasVerified(db, id, ["identity"]))) throw new AdminError("Open and verify an ID document first.");
    await db.query(`UPDATE acq_onboarding SET identity_verified_at = now(), verified_by = $2, updated_by = $3 WHERE id = $1`, [id, actor.id, actor.id]);
    return;
  }

  if (step === "ownership") {
    if (!row.identity_verified_at) throw new AdminError("Confirm their identity first.");
    const ownsIt = await hasVerified(db, id, ["ownership"]);
    if (!ownsIt && !(await hasVerified(db, id, ["authority"]))) throw new AdminError("Open and verify a proof of ownership or authority first.");
    await db.query(`UPDATE acq_onboarding SET ownership_verified_at = now(), verified_by = $2, updated_by = $3 WHERE id = $1`, [id, actor.id, actor.id]);
    // Only now can anyone be called a verified owner. Someone with authority stays a representative.
    await db.query(
      `UPDATE acq_prospects SET authority_status = 'verified', authority_verified_by = $2,
         owner_rep_class = CASE WHEN $3::boolean THEN 'verified_owner' ELSE 'representative' END, updated_by = $4
       WHERE id = $1`,
      [row.prospect_id, actor.id, ownsIt, actor.id],
    );
    return;
  }

  if (step === "availability") {
    await db.query(`UPDATE acq_onboarding SET availability_confirmed_at = now(), updated_by = $2 WHERE id = $1`, [id, actor.id]);
    return;
  }

  if (step === "terms") {
    const parsed = termsSchema.safeParse(input);
    if (!parsed.success) throw new AdminError(parsed.error.issues[0].message);
    await db.query(
      `UPDATE acq_onboarding SET terms_confirmed_at = now(), agreed_amount = $2, agreed_currency = $3, agreed_period = $4, marketing_terms = $5, updated_by = $6 WHERE id = $1`,
      [id, parsed.data.amount, parsed.data.currency, parsed.data.period, parsed.data.terms, actor.id],
    );
    return;
  }

  if (!row.ownership_verified_at) throw new AdminError("Confirm ownership or authority first.");
  if (!row.terms_confirmed_at) throw new AdminError("Confirm the price and terms first.");
  if (!(await hasVerified(db, id, ["marketing_authority"]))) throw new AdminError("Open and verify the signed marketing authority first.");
  await db.query(`UPDATE acq_onboarding SET authority_signed_at = now(), updated_by = $2 WHERE id = $1`, [id, actor.id]);

  // The mandate is secured. The database checks the signed authority is really there.
  const [prospect] = await db.query<{ status: string }>(`SELECT status FROM acq_prospects WHERE id = $1`, [row.prospect_id]);
  if (prospect.status !== "negotiating") await db.query(`UPDATE acq_prospects SET status = 'negotiating', updated_by = $2 WHERE id = $1`, [row.prospect_id, actor.id]);
  await db.query(`UPDATE acq_prospects SET status = 'mandate_secured', next_follow_up_at = NULL, updated_by = $2 WHERE id = $1`, [row.prospect_id, actor.id]);
}

/** Stops an onboarding that can't go ahead, such as when documents don't check out. */
export async function failOnboarding(db: Db, actor: Admin, brandId: string, id: string, reason: unknown): Promise<void> {
  requireSuperadmin(actor);
  const row = await requireOpen(db, brandId, id);
  const text = String(reason ?? "").trim();
  if (text.length < 3) throw new AdminError("Say why it's being stopped.");
  await db.query(`UPDATE acq_onboarding SET failed_reason = $2, updated_by = $3 WHERE id = $1`, [id, text.slice(0, 500), actor.id]);
  await db.query(`UPDATE acq_onboarding_links SET revoked_at = now() WHERE onboarding_id = $1 AND revoked_at IS NULL`, [id]);
  await db.query(`UPDATE acq_prospects SET authority_status = 'failed', owner_rep_class = 'unknown', authority_verified_by = NULL, updated_by = $2 WHERE id = $1`, [row.prospect_id, actor.id]);
}

/**
 * Sends the property to the Approvals queue as pending, at the agreed price. An admin who didn't
 * verify the documents gives the final approval there, and the database holds that true.
 */
export async function submitForApproval(db: Db, actor: Admin, brandId: string, id: string, input: Record<string, unknown>, photoRights: unknown): Promise<void> {
  requireSuperadmin(actor);
  const row = await requireOpen(db, brandId, id);
  const missing = [
    [row.identity_verified_at, "identity"],
    [row.ownership_verified_at, "ownership or authority"],
    [row.availability_confirmed_at, "availability"],
    [row.terms_confirmed_at, "price and terms"],
    [row.authority_signed_at, "the signed marketing authority"],
  ].filter(([done]) => !done).map(([, label]) => label);
  if (missing.length > 0) throw new AdminError(`Still to confirm: ${missing.join(", ")}.`);

  const rights = String(photoRights ?? "").trim();
  if (rights.length < 3) throw new AdminError("Say who owns the rights to the photos, and that they've authorised their use.");
  if (!String(input.heroUrl ?? "").trim()) throw new AdminError("Add at least the main photo.");

  await createOnboardedProperty(db, actor, brandId, id, {
    ...input,
    priceAmount: row.agreed_amount,
    priceCurrency: row.agreed_currency,
    pricePeriod: row.agreed_period,
  });
  await db.query(`UPDATE acq_onboarding SET photos_authorised_at = now(), photo_rights = $2, submitted_at = now(), updated_by = $3 WHERE id = $1`, [id, rights.slice(0, 500), actor.id]);
  await db.query(`UPDATE acq_onboarding_links SET revoked_at = now() WHERE onboarding_id = $1 AND revoked_at IS NULL`, [id]);
}

export type OnboardingCard = {
  id: string; prospectName: string; failedReason: string | null;
  identityAt: string | null; ownershipAt: string | null; availabilityAt: string | null; termsAt: string | null; authorityAt: string | null; submittedAt: string | null; finalApprovedAt: string | null;
  agreedAmount: string | null; agreedCurrency: string | null; agreedPeriod: string | null; terms: string | null;
  linkExpiresAt: string | null;
  documents: { id: string; docType: string; contentType: string; sizeBytes: number; verified: boolean; deleteAfter: string }[];
};

export async function listOnboarding(db: Db, actor: Admin, brandId: string): Promise<OnboardingCard[]> {
  requireSuperadmin(actor);
  return db.query<OnboardingCard>(
    `SELECT o.id, p.display_name AS "prospectName", o.failed_reason AS "failedReason",
       o.identity_verified_at::text AS "identityAt", o.ownership_verified_at::text AS "ownershipAt", o.availability_confirmed_at::text AS "availabilityAt",
       o.terms_confirmed_at::text AS "termsAt", o.authority_signed_at::text AS "authorityAt", o.submitted_at::text AS "submittedAt", o.final_approved_at::text AS "finalApprovedAt",
       o.agreed_amount::text AS "agreedAmount", o.agreed_currency AS "agreedCurrency", o.agreed_period AS "agreedPeriod", o.marketing_terms AS terms,
       (SELECT max(l.expires_at)::text FROM acq_onboarding_links l WHERE l.onboarding_id = o.id AND l.revoked_at IS NULL AND l.expires_at > now()) AS "linkExpiresAt",
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'docType', d.doc_type, 'contentType', d.content_type, 'sizeBytes', d.size_bytes, 'verified', d.verified_at IS NOT NULL, 'deleteAfter', d.delete_after::text) ORDER BY d.created_at)
                 FROM acq_onboarding_documents d WHERE d.onboarding_id = o.id), '[]') AS documents
     FROM acq_onboarding o JOIN acq_prospects p ON p.id = o.prospect_id
     WHERE o.brand_id = $1 ORDER BY o.failed_reason IS NOT NULL, o.final_approved_at IS NOT NULL, o.created_at DESC LIMIT 50`,
    [brandId],
  );
}
