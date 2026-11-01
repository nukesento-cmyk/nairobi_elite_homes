# Analytics events

All events go through `track()` in `apps/web/src/lib/analytics.ts`. **No provider is connected yet.** Until `setAnalyticsProvider()` is wired to GA4, Plausible or PostHog, production events are dropped and development events are logged to the browser console.

## Firing now

| Event | Properties | When |
|---|---|---|
| `join_click` | `source`, `placement` | Any join CTA is clicked |
| `community_status_viewed` | `status` | A marketing page loads, carrying the current community status |

### `join_click` sources

| Source | Placement | Where |
|---|---|---|
| `top_strip` | `global` | Sticky strip at the top of the page |
| `header` | `global` | Site header button |
| `footer` | `global` | Footer button |
| `floating_button` | `global` | Floating WhatsApp button on mobile |
| `hero` | `home_hero` | Homepage hero, primary button |
| `home_first_look`, `home_verified`, `home_land_safety`, `home_owner_contact` | `home_why_join` | Homepage "why join" cards |
| `interstitial` | `listing_grid` | Card inside the listing grid |
| `join_page` | `join_hero` | `/join`, main button |
| `join_page_closing` | `join_closing` | `/join`, closing button |
| `join_first_look`, `join_verified`, `join_land_safety`, `join_owner_contact`, `join_price_checks`, `join_network` | `join_why_join` | `/join` problem cards |

## Defined for later sprints

| Event | Properties |
|---|---|
| `view_listing` | `listingId` |
| `filter_used` | `filter` |
| `gallery_opened` | `listingId` |
| `exit_modal_shown`, `exit_modal_dismissed`, `exit_modal_clicked` | none |
| `lead_submitted` | `source` |
