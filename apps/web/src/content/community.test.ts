import { describe, expect, it } from "vitest";

import { parseSiteConfig, type RawSiteEnv } from "@/config/site";

import { getCommunityCopy, getSocialProofItems } from "./community";

const baseEnv: RawSiteEnv = {
  siteUrl: undefined,
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

const copyFor = (override: Partial<RawSiteEnv>) =>
  getCommunityCopy(parseSiteConfig({ ...baseEnv, ...override }));

describe("join page copy", () => {
  it("promises permanent free access only in founding", () => {
    const promise = /permanent free access/i;
    expect(copyFor({}).join.benefits.join()).toMatch(promise);
    expect(copyFor({ communityStatus: "paid" }).join.benefits.join()).not.toMatch(promise);
    expect(copyFor({ communityStatus: "waitlist" }).join.benefits.join()).not.toMatch(promise);
  });

  it("only calls joining free in founding", () => {
    for (const communityStatus of ["paid", "waitlist"]) {
      const copy = copyFor({ communityStatus });
      const text = [
        copy.heroAccess,
        copy.join.subhead,
        copy.join.offerBody,
        copy.cta.long,
        copy.listingGate.body,
        copy.listingGate.cta,
        copy.exitModal.body,
      ].join(" ");
      expect(text).not.toMatch(/\bfree\b/i);
    }
  });

  it("states both prices when set", () => {
    expect(copyFor({}).join.offerBody).toContain("KES 2,500/mo or USD 20/mo");
    expect(copyFor({ communityStatus: "paid" }).heroAccess).toBe(
      "Membership is KES 2,500/mo or USD 20/mo.",
    );
  });

  it("invents no price when none is set", () => {
    const unset = { paidPriceKes: "", paidPriceUsd: "" };
    expect(copyFor(unset).join.offerBody).not.toMatch(/KES|USD/);
    const paid = copyFor({ communityStatus: "paid", ...unset });
    expect([paid.heroAccess, paid.join.offerBody].join(" ")).not.toMatch(/KES|USD/);
  });
});

describe("social proof", () => {
  const itemsFor = (override: Partial<RawSiteEnv>) =>
    getSocialProofItems(parseSiteConfig({ ...baseEnv, ...override }));

  it("shows the figures that are set", () => {
    expect(itemsFor({})).toEqual([
      "1,240 members",
    ]);
  });

  it("shows the counted off-market listings, in exact numbers", () => {
    const config = parseSiteConfig(baseEnv);
    const withCount = (offMarketCount: number) => ({ ...config, community: { ...config.community, offMarketCount } });
    expect(getSocialProofItems(withCount(1))[1]).toBe("1 off-market listing shared first in the group");
    expect(getSocialProofItems(withCount(12))[1]).toBe("12 off-market listings shared first in the group");
  });

  it("shows nothing when no figures are set", () => {
    expect(itemsFor({ memberCount: "" })).toEqual([]);
  });
});

describe("exit modal copy", () => {
  it("states the cap only when it's set", () => {
    expect(copyFor({}).exitModal.body).toContain("1,500 members");
    expect(copyFor({ cap: "" }).exitModal.body).not.toMatch(/\d/);
  });
});
