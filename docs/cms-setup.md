# Connecting Sanity

Until `SANITY_PROJECT_ID` is set, the site shows sample listings. Each is labelled "Sample" and excluded from search.

## 1. Create the project

```bash
cd apps/studio
npx sanity login
npx sanity projects create "NairobiEliteHomes" --dataset production --dataset-visibility private
```

**The dataset must be private.** A public dataset lets anyone read off-market listings, including owner contact details, straight from Sanity's API, whatever the website does.

To check an existing dataset, run `npx sanity dataset list`. To fix one, run `npx sanity dataset visibility set production private`.

## 2. Deploy the Studio

```bash
SANITY_STUDIO_PROJECT_ID=<project id> npx sanity deploy
```

Marketing then edits content at the `*.sanity.studio` address it prints.

## 3. Connect the website

In [sanity.io/manage](https://www.sanity.io/manage), under API, create a token with the **Viewer** role. Set these in the hosting settings and in `apps/web/.env.local`:

```bash
SANITY_PROJECT_ID="<project id>"
SANITY_DATASET="production"
SANITY_API_READ_TOKEN="<viewer token>"
SANITY_REVALIDATE_SECRET="<long random string>"
```

None of these may have a `NEXT_PUBLIC_` prefix.

## 4. Update the site on publish

In the same API settings, create a webhook:

- **URL:** `https://<your site>/api/revalidate`
- **Trigger on:** create, update and delete
- **Filter:** `_type in ["listing", "whyJoinCard", "testimonial", "community", "communitySettings", "joinPage"]`
- **HTTP method:** POST
- **Header:** `Authorization` set to `Bearer <SANITY_REVALIDATE_SECRET>`

Without this webhook, a published change can take hours to appear. That includes moving a listing off-market, which keeps it visible until the cache expires. Test it before adding real listings.

## What marketing can edit

| In the Studio | Controls |
|---|---|
| Community Settings | Member count, spots cap, off-market count and paid prices. Empty fields fall back to the env values. |
| Join Page | `/join` copy for each community status. Empty fields keep the built-in copy. |
| Community | Area pages. A page's starter copy stays until a document with the same slug is published. |
| Listing, Why join card, Testimonial | Those items. |

Switching `NEXT_PUBLIC_COMMUNITY_STATUS` and swapping WhatsApp links remain env changes, followed by a redeploy.

## Known limit: image files

Sanity serves image files from public URLs, even from a private dataset. The site never sends a gated listing's image URL to the browser, only a tiny blurred placeholder. Anyone who has the full URL could still open that image, so don't paste those URLs anywhere public.
