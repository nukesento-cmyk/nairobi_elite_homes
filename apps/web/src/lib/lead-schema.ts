import { z } from "zod";

import { LEAD_AREAS, LEAD_BUDGETS } from "./lead-options";

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
