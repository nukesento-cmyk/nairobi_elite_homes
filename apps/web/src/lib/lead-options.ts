// Kept apart from lead-schema.ts so the form can use these without shipping Zod to browsers.

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
