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

export function directChatLink(message: string, config: SiteConfig = site): string {
  const url = new URL(config.whatsapp.directUrl);
  url.searchParams.set("text", message);
  return url.toString();
}

/**
 * Where a join CTA goes for the current community status. Only `founding` gets
 * the group invite: in `paid` and `waitlist` that link would let people skip
 * the paywall or the queue. Those states send visitors to /join to read the
 * pitch, and from there into a direct chat.
 */
export function joinLink(
  source: string,
  onJoinPage = false,
  config: SiteConfig = site,
): string {
  if (config.community.status === "founding") {
    return communityLink(source, "site", "founding_launch", config);
  }
  if (!onJoinPage) return "/join";

  return directChatLink(getCommunityCopy(config).directMessage, config);
}
