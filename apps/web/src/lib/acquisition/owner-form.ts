import { z } from "zod";

/** Shared by the form and the server, so the words shown are the words recorded. */
export const OWNER_CONSENT_VERSION = "2026-11-04";
export const OWNER_CONSENT_WORDING =
  "I agree that NairobiEliteHomes may keep these details and contact me by phone or email about marketing this property and related property services. I can ask them to stop at any time.";

export const OWNER_AREAS = ["Karen", "Runda", "Muthaiga", "Lavington", "Kilimani", "Kileleshwa", "Westlands", "Riverside", "Rosslyn", "Parklands", "Gigiri", "Elsewhere in Nairobi"] as const;

export const OWNER_ROLES = [
  { value: "owner", label: "I own it" },
  { value: "agent", label: "I'm authorised by the owner" },
  { value: "manager", label: "I manage it" },
] as const;

export const OWNER_PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "building", label: "Apartment building" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial property" },
] as const;

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

export const ownerSubmissionSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  organisation: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{7,18}$/, "Please enter a valid phone number."),
  email: z.preprocess(emptyToUndefined, z.email("Please enter a valid email address.").max(200).optional()),
  role: z.enum(["owner", "agent", "manager"], "Please choose how you're connected to the property."),
  area: z.enum(OWNER_AREAS, "Please choose an area."),
  propertyType: z.enum(["house", "apartment", "building", "land", "commercial"], "Please choose a property type."),
  intent: z.enum(["rent", "sale"], "Please choose rent or sale."),
  askingPriceKes: z.preprocess(emptyToUndefined, z.coerce.number("Please enter a number.").positive("Please enter a number above zero.").max(100_000_000_000).optional()),
  details: z.preprocess(emptyToUndefined, z.string().trim().max(1000, "Please keep this under 1,000 characters.").optional()),
  consent: z.literal(true, "Please tick the box so we can contact you."),
  /** A hidden field that only bots fill in. */
  company: z.string().max(200).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

export type OwnerSubmission = z.infer<typeof ownerSubmissionSchema>;
