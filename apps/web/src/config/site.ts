export const COMMUNITY_STATUSES = ["founding", "paid", "waitlist"] as const;
export type CommunityStatus = (typeof COMMUNITY_STATUSES)[number];

type RawValue = string | undefined;

export type RawSiteEnv = {
  siteUrl: RawValue;
  whatsappGroupUrl: RawValue;
  whatsappDirectUrl: RawValue;
  communityStatus: RawValue;
  memberCount: RawValue;
  cap: RawValue;
  offMarketCount: RawValue;
  paidPriceKes: RawValue;
  paidPriceUsd: RawValue;
  instagramUrl: RawValue;
  tiktokUrl: RawValue;
  xUrl: RawValue;
  facebookUrl: RawValue;
  youtubeUrl: RawValue;
  linkedinUrl: RawValue;
  salesEmail: RawValue;
  phone: RawValue;
};

export type SiteConfig = {
  name: string;
  url: string | null;
  whatsapp: { groupUrl: string; directUrl: string };
  community: {
    status: CommunityStatus;
    memberCount: number | null;
    cap: number | null;
    offMarketCount: number | null;
    /** Null when the count or cap is unknown, so copy never shows an invented number. */
    spotsLeft: number | null;
    paidPriceKes: number | null;
    paidPriceUsd: number | null;
  };
  socials: { label: string; url: string }[];
  contact: { email: string | null; phone: string | null };
};

function optional(value: RawValue): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseUrl(name: string, value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`Site config: ${name} is not a valid URL: "${value}"`);
  }
}

function requiredUrl(name: string, value: RawValue): string {
  const present = optional(value);
  if (!present) throw new Error(`Site config: ${name} is required`);
  return parseUrl(name, present);
}

function parseCount(name: string, value: RawValue): number | null {
  const present = optional(value);
  if (present === null) return null;
  if (!/^\d+$/.test(present)) {
    throw new Error(`Site config: ${name} must be a whole number: "${present}"`);
  }
  return Number(present);
}

function parseStatus(value: RawValue): CommunityStatus {
  const match = COMMUNITY_STATUSES.find((status) => status === value?.trim());
  if (!match) {
    throw new Error(
      `Site config: NEXT_PUBLIC_COMMUNITY_STATUS must be one of ${COMMUNITY_STATUSES.join(", ")}: "${value}"`,
    );
  }
  return match;
}

export function parseSiteConfig(env: RawSiteEnv): SiteConfig {
  const memberCount = parseCount("NEXT_PUBLIC_COMMUNITY_MEMBER_COUNT", env.memberCount);
  const cap = parseCount("NEXT_PUBLIC_COMMUNITY_CAP", env.cap);

  const socials = [
    { label: "Instagram", name: "NEXT_PUBLIC_INSTAGRAM_URL", value: env.instagramUrl },
    { label: "TikTok", name: "NEXT_PUBLIC_TIKTOK_URL", value: env.tiktokUrl },
    { label: "X", name: "NEXT_PUBLIC_X_URL", value: env.xUrl },
    { label: "Facebook", name: "NEXT_PUBLIC_FACEBOOK_URL", value: env.facebookUrl },
    { label: "YouTube", name: "NEXT_PUBLIC_YOUTUBE_URL", value: env.youtubeUrl },
    { label: "LinkedIn", name: "NEXT_PUBLIC_LINKEDIN_URL", value: env.linkedinUrl },
  ].flatMap(({ label, name, value }) => {
    const present = optional(value);
    return present ? [{ label, url: parseUrl(name, present) }] : [];
  });

  return {
    name: "NairobiEliteHomes",
    url: optional(env.siteUrl) ? parseUrl("NEXT_PUBLIC_SITE_URL", optional(env.siteUrl)!) : null,
    whatsapp: {
      groupUrl: requiredUrl("NEXT_PUBLIC_WHATSAPP_GROUP_URL", env.whatsappGroupUrl),
      directUrl: requiredUrl("NEXT_PUBLIC_WHATSAPP_DIRECT_URL", env.whatsappDirectUrl),
    },
    community: {
      status: parseStatus(env.communityStatus),
      memberCount,
      cap,
      offMarketCount: parseCount("NEXT_PUBLIC_COMMUNITY_OFF_MARKET_COUNT", env.offMarketCount),
      spotsLeft:
        memberCount !== null && cap !== null ? Math.max(cap - memberCount, 0) : null,
      paidPriceKes: parseCount("NEXT_PUBLIC_COMMUNITY_PAID_PRICE_KES", env.paidPriceKes),
      paidPriceUsd: parseCount("NEXT_PUBLIC_COMMUNITY_PAID_PRICE_USD", env.paidPriceUsd),
    },
    socials,
    contact: {
      email: optional(env.salesEmail),
      phone: optional(env.phone),
    },
  };
}

// Each variable is named in full because Next.js only inlines static
// process.env.NEXT_PUBLIC_* lookups into the browser bundle.
export const site = parseSiteConfig({
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  whatsappGroupUrl: process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL,
  whatsappDirectUrl: process.env.NEXT_PUBLIC_WHATSAPP_DIRECT_URL,
  communityStatus: process.env.NEXT_PUBLIC_COMMUNITY_STATUS,
  memberCount: process.env.NEXT_PUBLIC_COMMUNITY_MEMBER_COUNT,
  cap: process.env.NEXT_PUBLIC_COMMUNITY_CAP,
  offMarketCount: process.env.NEXT_PUBLIC_COMMUNITY_OFF_MARKET_COUNT,
  paidPriceKes: process.env.NEXT_PUBLIC_COMMUNITY_PAID_PRICE_KES,
  paidPriceUsd: process.env.NEXT_PUBLIC_COMMUNITY_PAID_PRICE_USD,
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL,
  tiktokUrl: process.env.NEXT_PUBLIC_TIKTOK_URL,
  xUrl: process.env.NEXT_PUBLIC_X_URL,
  facebookUrl: process.env.NEXT_PUBLIC_FACEBOOK_URL,
  youtubeUrl: process.env.NEXT_PUBLIC_YOUTUBE_URL,
  linkedinUrl: process.env.NEXT_PUBLIC_LINKEDIN_URL,
  salesEmail: process.env.NEXT_PUBLIC_SALES_EMAIL,
  phone: process.env.NEXT_PUBLIC_PHONE,
});
