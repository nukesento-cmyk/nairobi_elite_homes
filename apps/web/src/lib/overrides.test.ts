import { describe, expect, it } from "vitest";

import { applyCommunitySettings, parseSiteConfig, type RawSiteEnv } from "@/config/site";
import { applyJoinOverrides, getCommunityCopy } from "@/content/community";

const env: RawSiteEnv = {
  siteUrl: undefined,
  whatsappGroupUrl: "https://chat.whatsapp.com/ABC",
  whatsappDirectUrl: "https://wa.me/254700000000",
  communityStatus: "founding",
  memberCount: "1240",
  cap: "1500",
  offMarketCount: "300",
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
const config = parseSiteConfig(env);

describe("applyCommunitySettings", () => {
  it("keeps env values when the CMS has no settings", () => {
    expect(applyCommunitySettings(config, null)).toEqual(config);
  });

  it("lets the CMS override numbers and recalculates spots left", () => {
    const { community } = applyCommunitySettings(config, { memberCount: 1400, cap: 2000 });
    expect(community.memberCount).toBe(1400);
    expect(community.spotsLeft).toBe(600);
    expect(community.paidPriceKes).toBe(2500);
  });

  it("falls back to env for fields left empty in the CMS", () => {
    const { community } = applyCommunitySettings(config, { memberCount: null, cap: 1600 });
    expect(community.memberCount).toBe(1240);
    expect(community.spotsLeft).toBe(360);
  });

  it("treats zero as a real value", () => {
    expect(applyCommunitySettings(config, { offMarketCount: 0 }).community.offMarketCount).toBe(0);
  });

  it("flows through to the strip copy", () => {
    const live = applyCommunitySettings(config, { memberCount: 1499 });
    expect(getCommunityCopy(live).strip.highlight).toBe("1 spot left");
  });
});

describe("applyJoinOverrides", () => {
  const defaults = getCommunityCopy(config).join;

  it("keeps defaults with no overrides", () => {
    expect(applyJoinOverrides(defaults, null)).toEqual(defaults);
  });

  it("replaces only the fields that were filled in", () => {
    const merged = applyJoinOverrides(defaults, {
      headline: "New headline",
      subhead: "   ",
      offerBody: null,
      benefits: [],
    });
    expect(merged.headline).toBe("New headline");
    expect(merged.subhead).toBe(defaults.subhead);
    expect(merged.offerBody).toBe(defaults.offerBody);
    expect(merged.benefits).toEqual(defaults.benefits);
  });

  it("replaces benefits when some are provided", () => {
    expect(applyJoinOverrides(defaults, { benefits: ["One"] }).benefits).toEqual(["One"]);
  });
});
