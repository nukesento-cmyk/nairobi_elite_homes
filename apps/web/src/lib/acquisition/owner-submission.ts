import type { Db } from "@/lib/admin/accounts";

import { OWNER_CONSENT_VERSION, OWNER_CONSENT_WORDING, OWNER_PROPERTY_TYPES, type OwnerSubmission } from "./owner-form";
import { hashContact, saveLead } from "./research";
import { nairobiDate } from "./runner";
import { OPT_OUT_LINE } from "./score";
import { normaliseEmail, normalisePhone, type VerifiedContact, type VerifiedLead } from "./verify";

export type SubmissionResult = { outcome: "saved"; id: string } | { outcome: "not_kenyan_phone" } | { outcome: "suppressed" };

function categoryFor(input: OwnerSubmission): VerifiedLead["category"] {
  if (input.organisation && input.role === "manager") return "management_company";
  if (input.propertyType === "land") return "landowner";
  if (input.propertyType === "commercial") return "commercial_owner";
  if (input.propertyType === "building") return "apartment_owner_manager";
  return input.intent === "rent" ? "individual_landlord" : "home_seller";
}

/**
 * Saves what an owner or representative told us about themselves. It's recorded as their own
 * statement: only a person checking documents at onboarding can verify ownership.
 */
export async function saveOwnerSubmission(
  deps: { db: Db; brandId: string; hashKey: string; now?: () => Date },
  input: OwnerSubmission,
): Promise<SubmissionResult> {
  const { db, brandId, hashKey } = deps;
  const today = nairobiDate((deps.now ?? (() => new Date()))());

  const phone = normalisePhone(input.phone);
  if (!phone) return { outcome: "not_kenyan_phone" };
  const email = input.email ? normaliseEmail(input.email) : null;

  const contacts: VerifiedContact[] = [
    { kind: "phone", value: phone, contactClass: "owner_submitted" },
    ...(email ? [{ kind: "email" as const, value: email, contactClass: "owner_submitted" as const }] : []),
  ];

  // Their phone is on the opt-out list, so no lead is made. Fresh consent has to be recorded by a person.
  const [suppressed] = await db.query(
    `SELECT 1 FROM acq_suppression WHERE value_hash = $1`,
    [hashContact(hashKey, "phone", phone)],
  );
  if (suppressed) return { outcome: "suppressed" };

  const typeLabel = OWNER_PROPERTY_TYPES.find((type) => type.value === input.propertyType)?.label ?? "Property";
  const statement = `${typeLabel} in ${input.area}, for ${input.intent === "rent" ? "rent" : "sale"}, submitted through the website.`;

  const [record] = await db.query<{ id: string }>(
    `INSERT INTO acq_source_records (brand_id, url, outcome, extract) VALUES ($1, 'owner-form', 'stored', $2) RETURNING id`,
    [brandId, statement],
  );

  const evidence: VerifiedLead["evidence"] = [
    { claimType: "active_marketing", quote: statement },
    input.role === "owner"
      ? { claimType: "ownership_claim", quote: "Says they own this property." }
      : { claimType: "representation", quote: input.role === "agent" ? "Says they're authorised by the owner." : "Says they manage this property." },
    ...(input.details ? [{ claimType: "property_detail" as const, quote: input.details }] : []),
  ];

  const lead: VerifiedLead = {
    name: input.organisation ? `${input.name}, ${input.organisation}` : input.name,
    prospectType: input.organisation ? "organisation" : "person",
    category: categoryFor(input),
    role: input.role === "owner" ? "claims_owner" : "representative",
    area: input.area,
    locationText: null,
    propertyType: typeLabel.toLowerCase(),
    intent: input.intent,
    askingAmount: input.askingPriceKes ?? null,
    askingCurrency: input.askingPriceKes ? "KES" : null,
    unitCount: null,
    statedDate: today,
    evidence,
    contacts,
  };

  const place = input.area === "Elsewhere in Nairobi" ? "in Nairobi" : `in ${input.area}`;
  const script = `Good morning, this is {caller} from Nairobi Elite Homes. Thank you for submitting your ${typeLabel.toLowerCase()} ${place} through our website. Is now a good time to talk through the next steps? ${OPT_OUT_LINE}`;

  const id = await saveLead(deps, lead, record.id, "owner-form", today, {
    canonicalKey: `phone:${phone}`,
    authorityStatus: "self_declared",
    script,
  });
  if (!id) return { outcome: "suppressed" };

  for (const contact of contacts) {
    await db.query(
      `INSERT INTO acq_consents (brand_id, value_hash, wording_version, wording) VALUES ($1, $2, $3, $4)`,
      [brandId, hashContact(hashKey, contact.kind, contact.value), OWNER_CONSENT_VERSION, OWNER_CONSENT_WORDING],
    );
  }
  return { outcome: "saved", id };
}
