/** Kept apart from the server code, so the owner's upload form can use the same lists and limits. */
export const OWNER_DOCUMENT_TYPES = [
  { value: "identity", label: "ID or passport" },
  { value: "ownership", label: "Title deed or proof of ownership" },
  { value: "authority", label: "Authority to act for the owner, such as a power of attorney" },
  { value: "marketing_authority", label: "Signed marketing authority" },
  { value: "other", label: "Photos or anything else we asked for" },
] as const;

export type DocumentType = (typeof OWNER_DOCUMENT_TYPES)[number]["value"];

/** Vercel functions accept about 4.5 MB in a request, and encryption adds a little. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

export const ONBOARDING_STEPS = ["identity", "ownership", "availability", "terms", "authority"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
