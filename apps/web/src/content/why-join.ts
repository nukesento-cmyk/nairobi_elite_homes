// Shaped like the README's CMS blocks so this can move to the CMS in Sprint 2.
export type WhyJoinIcon = "clock" | "shield" | "map" | "phone" | "scale" | "users";

export type WhyJoinCard = {
  icon: WhyJoinIcon;
  title: string;
  problem: string;
  solution: string;
  ctaLabel: string;
  ctaSource: string;
};

export const whyJoinCards: WhyJoinCard[] = [
  {
    icon: "clock",
    title: "See it first",
    problem: "Everything good is gone before it's listed.",
    solution: "Off-market homes and land are shared in the group first.",
    ctaLabel: "Get first look",
    ctaSource: "first_look",
  },
  {
    icon: "shield",
    title: "Serious people only",
    problem: "You can't tell real listings from time-wasters.",
    solution: "Verified members only, with vetted owners and agents.",
    ctaLabel: "Meet the community",
    ctaSource: "verified",
  },
  {
    icon: "map",
    title: "Safer land deals",
    problem: "Land in Karen and Runda is a minefield of title, zoning and scams.",
    solution: "The group gets title-status notes, zoning flags and member warnings.",
    ctaLabel: "See the land notes",
    ctaSource: "land_safety",
  },
  {
    icon: "phone",
    title: "Reach owners directly",
    problem: "Agents won't call you back unless you're ready to pay.",
    solution: "Direct owner contact and a fast response culture inside the community.",
    ctaLabel: "Talk to owners",
    ctaSource: "owner_contact",
  },
  {
    icon: "scale",
    title: "Know the real price",
    problem: "Prices are quoted differently to diaspora buyers.",
    solution: "KES and USD transparency, with member-reported price checks.",
    ctaLabel: "Check real prices",
    ctaSource: "price_checks",
  },
  {
    icon: "users",
    title: "A quiet network",
    problem: "You hear about the best plots at a funeral, not online.",
    solution: "A curated, quiet network. That's what this is.",
    ctaLabel: "Join the network",
    ctaSource: "network",
  },
];
