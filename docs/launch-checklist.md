# Launch checklist

The build sprints are complete. These need accounts, real content or a decision.

## Accounts and services
- [ ] Sanity project with a **private** dataset and the webhook (`docs/cms-setup.md`). Connecting it removes all sample listings and photos.
- [ ] Postgres database, then `pnpm seed-admins` (`docs/admin-accounts.md`).
- [ ] Turnstile and Resend, or the lead form keeps refusing submissions.
- [ ] Analytics provider or log drain, or events and `clicked_join` counts aren't kept.
- [ ] Vercel Pro: the Hobby plan is for non-commercial use.
- [ ] Domain, then `NEXT_PUBLIC_SITE_URL`. Until it's set, search engines are blocked and the sitemap is empty.
- [ ] Remove Vercel login protection, so visitors and WhatsApp link previews can reach the site.

## Content and claims
- [ ] Real figures: member count, founding cap and off-market listing count.
- [ ] Confirm the site's promises are true, including "verified members", "vetted owners and agents" and "direct owner contact".
- [ ] Local review of the area pages, and a Kenyan property lawyer's review of "what to check before buying".
- [ ] Hero photo, favicon, Spline scenes and Matterport tours, with address and map turned off in each tour.

## Test once those exist
- [ ] A real lead reaches the inbox, and a Sanity publish updates the site through the webhook.
- [ ] Real Spline and Matterport embeds, and the site in Safari and Firefox.
- [ ] LCP on a real phone with real Sanity images. `/homes` and listing pages were about 4.2s and 3.7s under simulated slow 4G, over the 2.5s target.
- [ ] Switch through `founding`, `paid` and `waitlist` on the live site.
