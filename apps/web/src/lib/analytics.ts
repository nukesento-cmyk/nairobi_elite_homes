import type { CommunityStatus } from "@/config/site";

// Event names are documented for marketing in docs/analytics.md.
export type AnalyticsEvents = {
  view_listing: { listingId: string };
  filter_used: { filter: string };
  gallery_opened: { listingId: string };
  tour_opened: { listingId: string };
  join_click: { source: string; placement: string };
  exit_modal_shown: Record<string, never>;
  exit_modal_dismissed: Record<string, never>;
  exit_modal_clicked: Record<string, never>;
  lead_submitted: { source: string };
  community_status_viewed: { status: CommunityStatus };
};

export type AnalyticsProvider = (name: string, props: Record<string, unknown>) => void;

let provider: AnalyticsProvider | null = null;

/** Connects GA4, Plausible or PostHog. Until this is called, events go nowhere in production. */
export function setAnalyticsProvider(next: AnalyticsProvider | null): void {
  provider = next;
}

export function track<Name extends keyof AnalyticsEvents>(
  name: Name,
  props: AnalyticsEvents[Name],
): void {
  if (provider) {
    provider(name, props);
  } else if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", name, props);
  }
}
