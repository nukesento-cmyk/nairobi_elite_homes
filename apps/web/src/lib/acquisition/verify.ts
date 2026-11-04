import { z } from "zod";

export const CATEGORIES = ["individual_landlord", "home_seller", "apartment_owner_manager", "developer", "commercial_owner", "landowner", "portfolio_investor", "management_company", "business_with_portfolio"] as const;
export const CLAIM_TYPES = ["active_marketing", "ownership_claim", "representation", "developer_of_record", "portfolio_size", "property_detail", "contact"] as const;

/** What the model returns for a page. Nothing in it is believed until verifyExtraction has checked it. */
export const extractionSchema = z.object({
  is_opportunity: z.boolean(),
  prospect_name: z.string().nullable(),
  prospect_type: z.enum(["person", "organisation", "unknown"]),
  category: z.enum(CATEGORIES).nullable(),
  advertiser_role: z.enum(["unknown", "claims_owner", "representative", "agent", "developer_of_record"]),
  area: z.string().nullable(),
  location_text: z.string().nullable(),
  property_type: z.string().nullable(),
  intent: z.enum(["rent", "sale", "both", "unknown"]),
  asking_amount: z.number().nullable(),
  asking_currency: z.enum(["KES", "USD"]).nullable(),
  unit_count: z.number().nullable(),
  stated_date: z.string().nullable(),
  evidence: z.array(z.object({ claim_type: z.enum(CLAIM_TYPES), quote: z.string() })),
  contacts: z.array(z.object({
    kind: z.enum(["phone", "email"]),
    value: z.string(),
    belongs_to: z.enum(["organisation", "named_person"]),
  })),
});
export type Extraction = z.infer<typeof extractionSchema>;

export type VerifiedContact = {
  kind: "phone" | "email";
  value: string;
  contactClass: "organisation_line" | "named_business_role" | "individual_published";
};

export type VerifiedLead = {
  name: string;
  prospectType: "organisation";
  category: (typeof CATEGORIES)[number];
  role: Extraction["advertiser_role"];
  area: string | null;
  locationText: string | null;
  propertyType: string | null;
  intent: Extraction["intent"];
  askingAmount: number | null;
  askingCurrency: "KES" | "USD" | null;
  unitCount: number | null;
  statedDate: string | null;
  evidence: { claimType: (typeof CLAIM_TYPES)[number]; quote: string }[];
  contacts: VerifiedContact[];
};

export type Verdict =
  | { outcome: "lead"; lead: VerifiedLead; dropped: string[] }
  | { outcome: "no_lead"; reason: string }
  | { outcome: "person"; reason: string };

const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|icloud|live|aol|proton|protonmail)\./i;

const squash = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
const digitsOf = (text: string) => text.replace(/\D/g, "");

function onPage(page: string, claim: string): boolean {
  const wanted = squash(claim);
  return wanted.length > 0 && squash(page).includes(wanted);
}

/** Kenyan numbers as +254..., or null for anything else. */
export function normalisePhone(raw: string): string | null {
  const digits = digitsOf(raw);
  if (/^254[17]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  return null;
}

export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** The number as written on the page, in any spacing. A model's reformatted number still matches. */
function phoneOnPage(page: string, phone: string): boolean {
  const pageDigits = digitsOf(page);
  const national = phone.slice(4);
  return pageDigits.includes(`0${national}`) || pageDigits.includes(`254${national}`);
}

/** Claim types that can back each ownership or authority role. No evidence means unknown. */
const ROLE_NEEDS: Partial<Record<Extraction["advertiser_role"], (typeof CLAIM_TYPES)[number]>> = {
  claims_owner: "ownership_claim",
  representative: "representation",
  agent: "representation",
  developer_of_record: "developer_of_record",
};

/**
 * The gate between what the model says and what gets stored. Every quote and contact must really
 * be on the page, a field with no support is emptied, and private individuals never get through.
 */
export function verifyExtraction(page: string, raw: Extraction, today: string): Verdict {
  // Checked first, so nothing about a private person is kept even when the rest looks fine.
  if (raw.prospect_type === "person" || raw.category === "individual_landlord" || raw.category === "home_seller") {
    return { outcome: "person", reason: "Private individuals are skipped until counsel clears them." };
  }
  if (!raw.is_opportunity) return { outcome: "no_lead", reason: "Not a property marketing opportunity." };

  const dropped: string[] = [];
  const evidence = raw.evidence.filter((item) => {
    const ok = onPage(page, item.quote);
    if (!ok) dropped.push(`quote not on page (${item.claim_type})`);
    return ok;
  }).map((item) => ({ claimType: item.claim_type, quote: item.quote.replace(/\s+/g, " ").trim() }));

  if (!evidence.some((item) => item.claimType === "active_marketing" || item.claimType === "developer_of_record" || item.claimType === "portfolio_size")) {
    return { outcome: "no_lead", reason: "No verified evidence of a marketing need." };
  }
  if (!raw.prospect_name || !onPage(page, raw.prospect_name)) return { outcome: "no_lead", reason: "Name isn't on the page." };
  if (raw.prospect_type !== "organisation" || !raw.category) return { outcome: "no_lead", reason: "Couldn't confirm an organisation and category." };

  const keep = <T>(value: T | null, ok: boolean, label: string): T | null => {
    if (value === null) return null;
    if (!ok) dropped.push(`${label} not on page`);
    return ok ? value : null;
  };

  const needed = ROLE_NEEDS[raw.advertiser_role];
  const role = needed && !evidence.some((item) => item.claimType === needed) ? "unknown" : raw.advertiser_role;
  if (role !== raw.advertiser_role) dropped.push(`role ${raw.advertiser_role} had no evidence`);

  const amountShown = raw.asking_amount !== null && digitsOf(page).includes(String(Math.trunc(raw.asking_amount)));
  const askingAmount = keep(raw.asking_amount !== null && raw.asking_amount > 0 ? raw.asking_amount : null, amountShown, "price");
  const unitsShown = raw.unit_count !== null && evidence.some((item) => item.claimType !== "contact" && digitsOf(item.quote).includes(String(raw.unit_count)));
  const dateIsValid = raw.stated_date !== null && /^\d{4}-\d{2}-\d{2}$/.test(raw.stated_date) && !Number.isNaN(Date.parse(raw.stated_date)) && raw.stated_date <= today;

  const contacts: VerifiedContact[] = [];
  for (const contact of raw.contacts) {
    const value = contact.kind === "phone" ? normalisePhone(contact.value) : normaliseEmail(contact.value);
    const present = value !== null && (contact.kind === "phone" ? phoneOnPage(page, value) : onPage(page, value));
    if (!present) {
      dropped.push(`${contact.kind} not on page`);
      continue;
    }
    const personal = contact.kind === "email" && FREE_MAIL.test(value);
    contacts.push({
      kind: contact.kind,
      value,
      contactClass: personal ? "individual_published" : contact.belongs_to === "named_person" ? "named_business_role" : "organisation_line",
    });
  }

  return {
    outcome: "lead",
    dropped,
    lead: {
      name: raw.prospect_name.trim(),
      prospectType: "organisation",
      category: raw.category,
      role,
      area: keep(raw.area?.trim() || null, raw.area !== null && onPage(page, raw.area), "area"),
      locationText: keep(raw.location_text?.trim() || null, raw.location_text !== null && onPage(page, raw.location_text), "location"),
      propertyType: raw.property_type?.trim() || null,
      intent: raw.intent,
      askingAmount,
      askingCurrency: askingAmount === null ? null : raw.asking_currency,
      unitCount: keep(raw.unit_count !== null && raw.unit_count > 0 ? raw.unit_count : null, unitsShown, "unit count"),
      statedDate: raw.stated_date === null ? null : dateIsValid ? raw.stated_date : null,
      evidence,
      contacts,
    },
  };
}
