import { describe, expect, it } from "vitest";

import { parseSiteConfig, type RawSiteEnv } from "./site";

const baseEnv: RawSiteEnv = {
  whatsappGroupUrl: "https://chat.whatsapp.com/ABC",
  whatsappDirectUrl: "https://wa.me/254700000000",
  communityStatus: "founding",
  memberCount: "1240",
  cap: "1500",
  paidPriceKes: "2500",
  paidPriceUsd: "20",
  instagramUrl: "https://instagram.com/x",
  tiktokUrl: "",
  xUrl: undefined,
  facebookUrl: undefined,
  youtubeUrl: undefined,
  linkedinUrl: undefined,
  salesEmail: "hello@example.com",
  phone: "",
};

describe("parseSiteConfig", () => {
  it("computes spots left from the count and cap", () => {
    expect(parseSiteConfig(baseEnv).community.spotsLeft).toBe(260);
  });

  it("never reports negative spots", () => {
    const config = parseSiteConfig({ ...baseEnv, memberCount: "1600" });
    expect(config.community.spotsLeft).toBe(0);
  });

  it("leaves spots unknown when either number is missing", () => {
    expect(parseSiteConfig({ ...baseEnv, memberCount: "" }).community.spotsLeft).toBeNull();
    expect(parseSiteConfig({ ...baseEnv, cap: undefined }).community.spotsLeft).toBeNull();
  });

  it("drops empty socials and contact values", () => {
    const config = parseSiteConfig(baseEnv);
    expect(config.socials.map((social) => social.label)).toEqual(["Instagram"]);
    expect(config.contact.phone).toBeNull();
  });

  it.each([
    ["an unknown status", { communityStatus: "Founding" }, /COMMUNITY_STATUS/],
    ["a missing group link", { whatsappGroupUrl: "" }, /WHATSAPP_GROUP_URL/],
    ["a malformed direct link", { whatsappDirectUrl: "wa.me/254" }, /WHATSAPP_DIRECT_URL/],
    ["a malformed social link", { tiktokUrl: "tiktok" }, /TIKTOK_URL/],
    ["a non-numeric count", { memberCount: "1,240" }, /MEMBER_COUNT/],
  ])("rejects %s", (_name, override, message) => {
    expect(() => parseSiteConfig({ ...baseEnv, ...override })).toThrow(message);
  });
});
