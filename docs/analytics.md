# Analytics events

All events go through `track()` in `apps/web/src/lib/analytics.ts`. **No provider is connected yet.** Until `setAnalyticsProvider()` is wired to GA4, Plausible or PostHog, production events are dropped and development events are logged to the browser console.

## Firing now

| Event | Properties | When |
|---|---|---|
| `join_click` | `source`, `placement` | Any join CTA is clicked |
| `community_status_viewed` | `status` | A marketing page loads, carrying the current community status |

### `join_click` sources

| Source | Where |
|---|---|
| `top_strip` | Sticky strip at the top of the page |
| `header` | Site header button |
| `footer` | Footer button |
| `floating_button` | Floating WhatsApp button on mobile |

## Defined for later sprints

| Event | Properties |
|---|---|
| `view_listing` | `listingId` |
| `filter_used` | `filter` |
| `gallery_opened` | `listingId` |
| `exit_modal_shown`, `exit_modal_dismissed`, `exit_modal_clicked` | none |
| `lead_submitted` | `source` |
