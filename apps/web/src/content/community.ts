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
};

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-US")}`;
}

export function getCommunityCopy({ community }: SiteConfig): CommunityCopy {
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
      };
    }
    case "paid": {
      const { paidPriceKes } = community;
      return {
        strip: {
          showStatusDot: false,
          lead: "Members-only community ·",
          hideLeadOnPhones: true,
          highlight: null,
          tail: null,
          cta: paidPriceKes ? `Join for ${formatKes(paidPriceKes)}/mo` : "Become a member",
          arrow: "after-cta",
        },
        cta: { short: "Become a member", long: "Become a member" },
        directMessage: "Hi, I'd like to become a NairobiEliteHomes member.",
      };
    }
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
      };
  }
}
