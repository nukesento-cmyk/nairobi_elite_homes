import { site, type SiteConfig } from "@/config/site";
import { getCommunityCopy } from "@/content/community";

export function communityLink(
  source: string,
  medium = "site",
  campaign = "founding_launch",
  config: SiteConfig = site,
): string {
  if (!config.whatsapp.groupUrl) throw new Error("The group link is only available during founding.");
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
 * the group invite: in every other state that link would let people skip the
 * paywall, the queue or the admin. Those states send visitors to /join to read
 * why, and from there into a direct chat.
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
  // Requests are logged for the admins. The form falls back to a chat if it can't be.
  if (config.community.status === "closed") return "#request-access";

  return directChatLink(getCommunityCopy(config).directMessage, config);
}

/** Opens a chat with someone who asked for access. A leading 0 is a Kenyan local number. */
export function chatWithNumber(phone: string, message: string, config: SiteConfig = site): string {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "254");
  const url = new URL(digits, new URL(config.whatsapp.directUrl).origin);
  url.searchParams.set("text", message);
  return url.toString();
}

