import type { VerifiedLead } from "./verify";

export const PRIORITY_AREAS = ["Karen", "Runda", "Muthaiga", "Lavington", "Kilimani", "Kileleshwa", "Westlands", "Riverside", "Rosslyn", "Parklands", "Gigiri"];

export const OPT_OUT_LINE = "If you'd rather we didn't contact you again, just say so and we'll remove your details.";

export type Campaign = "vacant_rentals" | "premium_sales" | "developers" | "commercial" | "portfolio";

export type ScoreBreakdown = {
  activeNeed: number;
  relevance: number;
  contactability: number;
  quality: number;
  portfolio: number;
  recency: number;
};

const daysBetween = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);

export function isPriorityArea(area: string | null): boolean {
  const text = area?.toLowerCase() ?? "";
  return PRIORITY_AREAS.some((name) => text.includes(name.toLowerCase()));
}

/**
 * Points come only from what was verified on the page. There are no estimates of value, wealth
 * or commission, and a blocked contact class earns nothing for contactability.
 */
export function scoreLead(lead: VerifiedLead, callableClasses: string[], today: string): { score: number; breakdown: ScoreBreakdown } {
  const hasNeed = lead.evidence.some((item) => item.claimType === "active_marketing");
  const recent = lead.statedDate !== null ? daysBetween(lead.statedDate, today) : null;

  const breakdown: ScoreBreakdown = {
    activeNeed: hasNeed ? (recent !== null && recent <= 90 ? 25 : 18) : lead.evidence.length > 0 ? 10 : 0,
    relevance: (isPriorityArea(lead.area) || isPriorityArea(lead.locationText) ? 14 : 0) + 6,
    contactability: lead.contacts.some((contact) => callableClasses.includes(contact.contactClass)) ? 20 : 0,
    quality: (lead.area ? 5 : 0) + (lead.propertyType ? 5 : 0) + (lead.askingAmount !== null ? 5 : 0),
    portfolio: lead.unitCount === null ? 0 : lead.unitCount >= 10 ? 10 : lead.unitCount >= 2 ? 5 : 0,
    recency: recent === null ? 0 : recent <= 30 ? 10 : recent <= 90 ? 5 : 0,
  };
  const score = Object.values(breakdown).reduce((total, points) => total + points, 0);
  return { score, breakdown };
}

export function chooseCampaign(lead: VerifiedLead): Campaign {
  if (lead.category === "developer") return "developers";
  if (lead.category === "commercial_owner") return "commercial";
  if (["portfolio_investor", "management_company", "business_with_portfolio"].includes(lead.category)) return "portfolio";
  return lead.intent === "rent" ? "vacant_rentals" : "premium_sales";
}

/** Each sentence is written only if its facts were verified. A missing one is dropped, never guessed. */
export function openingScript(lead: VerifiedLead, campaign: Campaign, sourceHost: string): string {
  const place = lead.area ? ` in ${lead.area}` : "";
  const thing = lead.propertyType ? `the ${lead.propertyType}${place}` : `your property${place}`;
  const opening = "Good morning, this is {caller} from Nairobi Elite Homes.";

  const body: Record<Campaign, string> = {
    vacant_rentals: `I saw ${thing} advertised for rent on ${sourceHost}. Am I speaking to the right person about it? I wanted to ask if it's still available and whether you'd be open to a short chat.`,
    premium_sales: `I saw ${thing} on ${sourceHost}, advertised for sale. Are you the right person to speak to? I'd like to ask how the sale is going.`,
    developers: `I'm calling about ${lead.name}'s project${place}, which I saw on ${sourceHost}. Who looks after sales and marketing for it? We'd like to explain how we could market its units.`,
    commercial: `I saw ${thing} on ${sourceHost}. Is this the right office for the letting or sale? I'd like to ask what kind of occupier or buyer you're looking for.`,
    portfolio: `${lead.name}'s website mentions properties${place}. Who handles how they're marketed? We'd like to learn whether we could support any vacancies or sales.`,
  };
  return `${opening} ${body[campaign]} ${OPT_OUT_LINE}`;
}
