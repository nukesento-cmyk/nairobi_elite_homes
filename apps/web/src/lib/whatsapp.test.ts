import { describe, expect, it } from "vitest";

import { parseSiteConfig, type CommunityStatus, type SiteConfig } from "@/config/site";

import { communityLink, joinLink } from "./whatsapp";

function configFor(communityStatus: CommunityStatus): SiteConfig {
  return parseSiteConfig({
    whatsappGroupUrl: "https://chat.whatsapp.com/ABC",
    whatsappDirectUrl: "https://wa.me/254700000000",
    communityStatus,
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
  });
}

describe("communityLink", () => {
  it("adds the UTM parameters", () => {
    const url = new URL(communityLink("hero", "site", "founding_launch", configFor("founding")));
    expect(url.origin + url.pathname).toBe("https://chat.whatsapp.com/ABC");
    expect(url.searchParams.get("utm_source")).toBe("hero");
    expect(url.searchParams.get("utm_medium")).toBe("site");
    expect(url.searchParams.get("utm_campaign")).toBe("founding_launch");
  });
});

describe("joinLink", () => {
  it("sends founding visitors to the group with attribution", () => {
    const url = new URL(joinLink("footer", false, configFor("founding")));
    expect(url.hostname).toBe("chat.whatsapp.com");
    expect(url.searchParams.get("utm_source")).toBe("footer");
  });

  it.each(["paid", "waitlist"] as const)("sends %s visitors to /join first", (status) => {
    expect(joinLink("footer", false, configFor(status))).toBe("/join");
  });

  it.each(["paid", "waitlist"] as const)(
    "opens a direct chat from /join, never the group invite, when status is %s",
    (status) => {
      const url = new URL(joinLink("join_page", true, configFor(status)));
      expect(url.hostname).toBe("wa.me");
      expect(url.searchParams.get("text")).toContain("NairobiEliteHomes");
    },
  );
});
