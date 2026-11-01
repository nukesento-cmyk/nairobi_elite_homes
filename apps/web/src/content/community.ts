import type { SiteConfig } from "@/config/site";

export type CommunityCopy = {
  strip: {
    showStatusDot: boolean;
    lead: string;
    /** The lead doesn't fit beside the rest on a phone, so it gives way. */
    hideLeadOnPhones: boolean;
    highlight: string | null;
    tail: string | null;
    cta: string;
    arrow: "before-cta" | "after-cta";
  };
  cta: { short: string; long: string };
  /** Prefilled message when the CTA opens a direct chat instead of the group. */
  directMessage: string;
  heroAccess: string;
  listingGate: { title: string; body: string; cta: string };
  exitModal: { title: string; body: string };
  join: {
    badge: string;
    headline: string;
    subhead: string;
    benefits: string[];
    offerTitle: string;
    offerBody: string;
    closingHeadline: string;
  };
};

const ABOUT =
  "NairobiEliteHomes is a private community of serious buyers, renters, sellers and landowners in Nairobi's premium areas.";

const MEMBER_BENEFITS = [
  "First look at off-market homes and land",
  "Direct contact with owners",
  "Title-status notes and zoning flags on land",
];

function formatPrice(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString("en-US")}/mo`;
}

/** "KES 2,500/mo or USD 20/mo", or null when no price is set. */
function formatPaidPrice({ paidPriceKes, paidPriceUsd }: SiteConfig["community"]): string | null {
  const prices = [
    paidPriceKes ? formatPrice("KES", paidPriceKes) : null,
    paidPriceUsd ? formatPrice("USD", paidPriceUsd) : null,
  ].filter(Boolean);
  return prices.length > 0 ? prices.join(" or ") : null;
}

export function getCommunityCopy({ community }: SiteConfig): CommunityCopy {
  const paidPrice = formatPaidPrice(community);

  switch (community.status) {
    case "founding": {
      const { spotsLeft } = community;
      return {
        strip: {
          showStatusDot: true,
          lead: spotsLeft ? "Founding access is open —" : "Founding access is open",
          hideLeadOnPhones: Boolean(spotsLeft),
          highlight: spotsLeft
            ? `${spotsLeft.toLocaleString("en-US")} ${spotsLeft === 1 ? "spot" : "spots"} left`
            : null,
          tail: spotsLeft ? "before we close free entry." : null,
          cta: "Join the group",
          arrow: "before-cta",
        },
        cta: { short: "Join free", long: "Join the private community" },
        directMessage: "Hi, I'd like to join the NairobiEliteHomes community.",
        heroAccess: "Joining is free today. Soon it becomes paid and members-only.",
        listingGate: {
          title: "Exact location and owner contact",
          body: "These are shared in the private group. Join (free) to request a viewing.",
          cta: "Join free to request a viewing",
        },
        exitModal: {
          title: "Before you go",
          body: community.cap
            ? `Founding access closes at ${community.cap.toLocaleString("en-US")} members. Grab your free spot.`
            : "Founding access won't stay open for long. Grab your free spot.",
        },
        join: {
          badge: "Founding access open",
          headline: "Join before the door closes.",
          subhead: `${ABOUT} Joining the WhatsApp group is free today. Soon it becomes paid and members-only.`,
          benefits: ["Permanent free access as a founding member", ...MEMBER_BENEFITS],
          offerTitle: "Free now, paid soon",
          offerBody: paidPrice
            ? `After launch, new members pay ${paidPrice}. Founding members stay free.`
            : "After launch, new members pay a monthly fee. Founding members stay free.",
          closingHeadline: "Take your founding spot while it's free.",
        },
      };
    }
    case "paid":
      return {
        strip: {
          showStatusDot: false,
          lead: "Members-only community ·",
          hideLeadOnPhones: true,
          highlight: null,
          tail: null,
          cta: community.paidPriceKes
            ? `Join for ${formatPrice("KES", community.paidPriceKes)}`
            : "Become a member",
          arrow: "after-cta",
        },
        cta: { short: "Become a member", long: "Become a member" },
        directMessage: "Hi, I'd like to become a NairobiEliteHomes member.",
        heroAccess: paidPrice ? `Membership is ${paidPrice}.` : "Membership is by monthly subscription.",
        listingGate: {
          title: "Exact location and owner contact",
          body: "These are shared with members. Become a member to request a viewing.",
          cta: "Become a member",
        },
        exitModal: {
          title: "Before you go",
          body: "Members see off-market homes and land before anyone else.",
        },
        join: {
          badge: "Members only",
          headline: "Get inside Nairobi's private property network.",
          subhead: `${ABOUT} Membership gives you what never reaches the public site.`,
          benefits: MEMBER_BENEFITS,
          offerTitle: "Membership",
          offerBody: paidPrice
            ? `${paidPrice}. Message us on WhatsApp to become a member.`
            : "Message us on WhatsApp for current membership pricing.",
          closingHeadline: "Ready to become a member?",
        },
      };
    case "waitlist":
      return {
        strip: {
          showStatusDot: false,
          lead: "Founding spots are full —",
          hideLeadOnPhones: false,
          highlight: null,
          tail: null,
          cta: "join the waitlist",
          arrow: "after-cta",
        },
        cta: { short: "Join waitlist", long: "Join the waitlist" },
        directMessage: "Hi, I'd like to join the NairobiEliteHomes waitlist.",
        heroAccess: "Founding spots are full. The waitlist is open.",
        listingGate: {
          title: "Exact location and owner contact",
          body: "These are shared with members. Join the waitlist to get in line.",
          cta: "Join the waitlist",
        },
        exitModal: {
          title: "Before you go",
          body: "Founding spots are full, but you can still get in line for the next opening.",
        },
        join: {
          badge: "Waitlist open",
          headline: "Founding spots are full.",
          subhead: `${ABOUT} The founding round has closed, but you can still get in line.`,
          benefits: MEMBER_BENEFITS,
          offerTitle: "What happens next",
          offerBody: "Message us on WhatsApp to join the waitlist. We'll tell you when a place opens.",
          closingHeadline: "Get on the waitlist.",
        },
      };
  }
}

/** The proof line under the hero. Only includes figures that have been set. */
export function getSocialProofItems({ community }: SiteConfig): string[] {
  const items: string[] = [];
  if (community.memberCount) {
    items.push(`${community.memberCount.toLocaleString("en-US")} members`);
  }
  if (community.offMarketCount) {
    items.push(
      `${community.offMarketCount.toLocaleString("en-US")}+ off-market listings shared first in the group`,
    );
  }
  return items;
}
