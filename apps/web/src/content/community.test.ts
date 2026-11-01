import { describe, expect, it } from "vitest";

import { parseSiteConfig, type RawSiteEnv } from "@/config/site";

import { getCommunityCopy } from "./community";

const baseEnv: RawSiteEnv = {
  whatsappGroupUrl: "https://chat.whatsapp.com/ABC",
  whatsappDirectUrl: "https://wa.me/254700000000",
  communityStatus: "founding",
  memberCount: "1240",
  cap: "1500",
  paidPriceKes: "2500",
  paidPriceUsd: "20",
  instagramUrl: undefined,
  tiktokUrl: undefined,
  xUrl: undefined,
  facebookUrl: undefined,
  youtubeUrl: undefined,
  linkedinUrl: undefined,
  salesEmail: undefined,
  phone: undefined,
};

const stripFor = (override: Partial<RawSiteEnv>) =>
  getCommunityCopy(parseSiteConfig({ ...baseEnv, ...override })).strip;

describe("urgency strip copy", () => {
  it("shows spots left in founding", () => {
    const strip = stripFor({});
    expect(strip.highlight).toBe("260 spots left");
    expect(strip.cta).toBe("Join the group");
  });

  it("uses the singular for one spot", () => {
    expect(stripFor({ memberCount: "1499" }).highlight).toBe("1 spot left");
  });

  it.each([
    ["the numbers are unset", { memberCount: "", cap: "" }],
    ["the cap has been reached", { memberCount: "1500" }],
  ])("drops the scarcity claim when %s", (_name, override) => {
    const strip = stripFor(override);
    expect(strip.highlight).toBeNull();
    expect(strip.tail).toBeNull();
    expect(strip.lead).toBe("Founding access is open");
    expect(strip.hideLeadOnPhones).toBe(false);
  });

  it("shows the formatted price in paid", () => {
    expect(stripFor({ communityStatus: "paid" }).cta).toBe("Join for KES 2,500/mo");
  });

  it("omits the price in paid when it is unset", () => {
    expect(stripFor({ communityStatus: "paid", paidPriceKes: "" }).cta).toBe("Become a member");
  });

  it("points to the waitlist in waitlist", () => {
    const strip = stripFor({ communityStatus: "waitlist" });
    expect(strip.lead).toBe("Founding spots are full —");
    expect(strip.cta).toBe("join the waitlist");
  });
});
