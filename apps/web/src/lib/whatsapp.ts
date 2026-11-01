import { site, type SiteConfig } from "@/config/site";
import { getCommunityCopy } from "@/content/community";

export function communityLink(
  source: string,
  medium = "site",
  campaign = "founding_launch",
  config: SiteConfig = site,
): string {
  const url = new URL(config.whatsapp.groupUrl);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

/**
 * Where a join CTA goes for the current community status. Only `founding` gets
 * the group invite: in `paid` and `waitlist` that link would let people skip
 * the paywall or the queue, so those states open a direct chat instead.
 */
export function joinLink(source: string, config: SiteConfig = site): string {
  if (config.community.status === "founding") {
    return communityLink(source, "site", "founding_launch", config);
  }
  const url = new URL(config.whatsapp.directUrl);
  url.searchParams.set("text", getCommunityCopy(config).directMessage);
  return url.toString();
}
