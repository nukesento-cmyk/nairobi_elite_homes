import { z } from "zod";

export const LEAD_INTENTS = [
  { value: "buy", label: "Buy" },
  { value: "rent", label: "Rent" },
  { value: "sell", label: "Sell" },
  { value: "land", label: "Land" },
] as const;

export const LEAD_BUDGETS = [
  "Under KES 20M",
  "KES 20M to 50M",
  "KES 50M to 100M",
  "Over KES 100M",
  "Rental: under KES 200K/mo",
  "Rental: over KES 200K/mo",
] as const;

export const LEAD_AREAS = ["Karen", "Runda", "Kilimani", "Rosslyn", "Lavington", "Muthaiga"] as const;

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{7,18}$/, "Please enter a valid phone number."),
  email: z.email("Please enter a valid email address.").max(200),
  intent: z.enum(["buy", "rent", "sell", "land"], "Please choose what you're looking to do."),
  budget: z.enum(LEAD_BUDGETS).optional(),
  areas: z.array(z.enum(LEAD_AREAS)).max(LEAD_AREAS.length).default([]),
  source: z.string().trim().min(1).max(60),
  listing: z.string().trim().max(120).optional(),
  /** A hidden field that only bots fill in. */
  company: z.string().max(200).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

export type Lead = z.infer<typeof leadSchema>;
