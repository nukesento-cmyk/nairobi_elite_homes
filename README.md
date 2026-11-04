# NairobiEliteHomes — Developer Handoff & Build Instructions

**Stack assumed:** Next.js (App Router) + TypeScript + Tailwind + Sanity/Payload CMS + Framer Motion + Lenis + Spline. If you're on something else, the flow still maps — just swap the libraries.

Read this top to bottom before writing code. The flow and the "why" matter more than the "how."

---

## 0. The One-Paragraph Brief

We're building a **premium, multi-vertical property platform** (homes + land, expandable) for Nairobi's high-end market (Karen, Runda, Kilimani, Rosslyn, Lavington, Muthaiga). The site's job is **not just to show houses — it's to convert visitors into members of a private WhatsApp community** that is currently free but will become **paid/members-only soon**. Every design and copy decision ladders up to: *make the visitor feel the need to join before the door closes.* All social/WhatsApp links live in env vars so marketing can swap them without a deploy.

---

## 1. Environment Variables (set these up FIRST)

Create `.env.local` (and mirror in Vercel/hosting env settings). Marketing owns these values — the dev never hardcodes a link anywhere in the codebase.

```bash
# .env.local

# --- Community / Conversion ---
NEXT_PUBLIC_WHATSAPP_GROUP_URL="https://chat.whatsapp.com/XXXXXXXXXXXX"
NEXT_PUBLIC_WHATSAPP_DIRECT_URL="https://wa.me/2547XXXXXXXX"
NEXT_PUBLIC_COMMUNITY_STATUS="founding"        # "founding" | "paid" | "waitlist"
NEXT_PUBLIC_COMMUNITY_MEMBER_COUNT="1240"       # social proof number, update via CMS ideally
NEXT_PUBLIC_COMMUNITY_CAP="1500"                # "only X spots left before we close free access"
NEXT_PUBLIC_COMMUNITY_PAID_PRICE_KES="2500"     # shown as "after launch: KES 2,500/mo"
NEXT_PUBLIC_COMMUNITY_PAID_PRICE_USD="20"

# --- Social ---
NEXT_PUBLIC_INSTAGRAM_URL="https://instagram.com/nairobielitehomes"
NEXT_PUBLIC_TIKTOK_URL="https://tiktok.com/@nairobielitehomes"
NEXT_PUBLIC_X_URL="https://x.com/nairobielitehomes"
NEXT_PUBLIC_FACEBOOK_URL="https://facebook.com/nairobielitehomes"
NEXT_PUBLIC_YOUTUBE_URL="https://youtube.com/@nairobielitehomes"
NEXT_PUBLIC_LINKEDIN_URL="https://linkedin.com/company/nairobielitehomes"

# --- Contact ---
NEXT_PUBLIC_SALES_EMAIL="hello@nairobielitehomes.co.ke"
NEXT_PUBLIC_PHONE="+2547XXXXXXXX"
```

**Rules:**
- Expose only `NEXT_PUBLIC_*` vars to the client. Anything secret stays server-side.
- Build a single `config/site.ts` that reads these once and exports a typed object. Every component imports from there — **zero hardcoded URLs anywhere else**.
- The `COMMUNITY_STATUS` var is the master switch for the whole conversion narrative (see §4). Flipping it from `founding` → `paid` should change copy, badges, and CTAs across the site **without touching component code**.

---

## 2. Project Structure

```
/app
  /(marketing)              # public site
    /page.tsx               # home — the conversion funnel
    /homes/page.tsx
    /land/page.tsx
    /communities/[slug]/page.tsx
    /listings/[id]/page.tsx
    /join/page.tsx          # dedicated WhatsApp/community landing page
    /about/page.tsx
  /(members)                # gated later — scaffold now, gate later
    /private/page.tsx
  /studio/[...]             # CMS studio (if Sanity)
  /api/
    /lead/route.ts          # form submissions → CRM/email
    /og/route.tsx           # dynamic OG images per listing
/components
  /ui                       # buttons, inputs, cards, badges
  /marketing                # HeroScroll, JoinBanner, SocialProofBar, UrgencyStrip
  /property                 # PropertyCard, PropertyGallery, PropertyFilters, MatterportEmbed
  /motion                   # ScrollReveal, Parallax, LenisProvider
/config
  site.ts                   # single source of truth from env
  design-tokens.ts          # colors, type scale, spacing
  nav.ts
/lib
  cms.ts                    # typed queries
  analytics.ts              # event tracking wrapper
  whatsapp.ts               # UTM-aware link builder
/content                    # copy strings (or CMS-driven — see §7)
```

---

## 3. Design Tokens (lock before building UI)

Put these in `tailwind.config.ts` + `design-tokens.ts`. No ad-hoc hex codes in components, ever.

```ts
// config/design-tokens.ts
export const colors = {
  forest:  { 950:'#0E1A14', 900:'#1F3A2E', 800:'#2E4A3A' },
  midnight:{ 950:'#0B0D14', 900:'#1A1F2E' },
  slate:   { 950:'#14161A', 900:'#2A2D33', 800:'#2E3238' },
  bone:    { 50:'#E8E2D4', 100:'#F2EAE0', 200:'#C4B8A0' },
  copper:  { DEFAULT:'#B87333', 600:'#A5652B', 400:'#D08B4A' },
  terracotta: { DEFAULT:'#C56B4A' },
}
```

- **Dark base = forest (primary) or slate (land vertical).** Copper = CTAs, hovers, thin dividers, icon strokes. Bone = text on dark. **Never pure white, never gold.**
- Type: serif display (`Fraunces` or `Canela`) for headlines, `Inter`/`Satoshi` for UI. Use CSS `clamp()` for fluid headline scale.
- Add a 3–5% film-grain overlay on gradients (cheap, huge perceived-value win — a single SVG noise PNG at low opacity).
- Spacing scale: generous. Section padding `clamp(80px, 12vw, 160px)` vertical.

---

## 4. The Conversion Flow (THE CORE OF THIS BUILD)

This is the part to get right. The site has **one primary conversion goal: join the WhatsApp community.** Everything else (listings, land, browse) is supporting evidence that the community is worth joining. Design the flow as a funnel with multiple, non-annoying touchpoints.

### 4.1 The narrative (drives all copy)

> "NairobiEliteHomes is a **private** community of serious buyers, renters, sellers, and landowners in Nairobi's premium areas. Right now, joining the WhatsApp group is **free**. Soon it becomes **paid members-only**. Founding members get **permanent free access** + **first look at off-market listings** + **direct owner contact** — listings that never hit the public site."

Everything on the site supports this: scarcity (spots left), social proof (member count), exclusivity (off-market), and a clear deadline/status.

### 4.2 Touchpoints (map them in order of a visitor's journey)

**A. Sticky top strip (global, dismissible per session):**
- Copy driven by `COMMUNITY_STATUS`:
  - `founding`: "🟢 Founding access is open — **{spotsLeft} spots left** before we close free entry. → **Join the group**"
  - `paid`: "Members-only community · **Join for KES {price}/mo** →"
  - `waitlist`: "Founding spots are full — **join the waitlist** →"
- This strip is the single highest-ROI element on the site. Make it tasteful: copper text on forest, 40px tall, no flashy blinking.

**B. Hero (homepage):**
- Cinematic image + headline ("Private access to Nairobi's most sought-after homes and land.")
- **Two CTAs, visually ranked:** primary = "Join the private community" (copper, solid); secondary = "Browse listings" (ghost/outline). The primary must win the eye test.
- Below headline: a **social proof line** — "1,240 members · 300+ off-market listings shared first in the group" — numbers from env/CMS.

**C. "Why join" section (homepage, mid-scroll):**
- 3–4 cards, each solving a **real problem** (see §5). This is where you sell the *need* to join, not the houses.
- Each card: problem → what the community does about it → mini-CTA.

**D. After every N listings (grid):**
- Insert a **"You're seeing ~40% of what's available"** interstitial card. Copy: "Off-market homes and land are shared in the group first. **Join to see them.**" Link → WhatsApp with UTM. This is the highest-converting placement — the visitor has just proven interest by scrolling listings.

**E. Listing detail pages:**
- Gate **contact details and exact location** behind a soft join prompt: "Exact location and owner contact are shared in the private group. **Join (free) to request a viewing.**"
- Show a blurred/frosted map or address until joined — tasteful, not scammy.
- Every listing page gets a fixed bottom bar on mobile: "Join the community" + "WhatsApp us."

**F. Exit-intent (desktop only, once per session):**
- Modal: "Before you go — founding access closes at {cap}. **Grab your free spot.**" One dismiss, don't re-fire.

**G. `/join` dedicated page:**
- Full pitch: what you get, social proof, member testimonials (real ones via CMS), the "free now, paid soon" framing, spots-left progress bar, and the big WhatsApp button.
- **All paid ads / social posts should point here**, not the homepage. It's the conversion-optimized landing page.

**H. Footer + floating WhatsApp button (mobile):**
- Persistent floating WhatsApp button (bottom-right, copper, subtle pulse — respect `prefers-reduced-motion`). Opens the group link with UTM.

### 4.3 Link building (never link raw)

Build one helper in `lib/whatsapp.ts`:

```ts
export function communityLink(source: string, medium = "site", campaign = "founding_launch") {
  const u = new URL(process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL!);
  u.searchParams.set("utm_source", source);
  u.searchParams.set("utm_medium", medium);
  u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}
```

Every CTA passes a distinct `source` (`hero`, `interstitial`, `listing_detail`, `exit_modal`, `footer`, `join_page`…) so marketing can see **which placement converts** in analytics. WhatsApp group links carry the UTM in the invite URL — most analytics tools will register the click-through on your side even if WhatsApp doesn't pass it onward; combine with a `/api/lead` "clicked_join" event (see §6) to measure properly.

### 4.4 Analytics events to fire (minimal, meaningful)

- `view_listing`, `filter_used`, `gallery_opened`
- `join_click` (with `source`, `placement`)
- `exit_modal_shown`, `exit_modal_dismissed`, `exit_modal_clicked`
- `lead_submitted`
- `community_status_viewed` (carry the env status — so you can compare conversion pre/post paywall)

Wrap in `lib/analytics.ts` so the provider is swappable (GA4, Plausible, PostHog).

---

## 5. The "Solve a Problem" Content Framework

Each "why join" card and each `/join` section must map to a **concrete Nairobi buyer/renter pain**. Dev responsibility: build these as **CMS-editable blocks**, not hardcoded. Suggested starting set (marketing can reword):

1. **"Everything good is gone before it's listed."** → Off-market homes & land shared in the group first.
2. **"You can't tell real listings from time-wasters."** → Verified members only; vetted owners and agents.
3. **"Land in Karen/Runda is a minefield — title, zoning, scams."** → Group gets title-status notes, zoning flags, and member warnings (esp. for the land vertical).
4. **"Agents won't call you back unless you're ready to pay."** → Direct owner contact + fast response culture inside the community.
5. **"Prices are quoted differently to diaspora buyers."** → KES/USD transparency, member-reported price checks.
6. **"You hear about the best plots at a funeral, not online."** → A curated, quiet network — that's what this is.

Build these as `{ icon, title, problem, solution, ctaLabel, ctaSource }` CMS items. Render as cards; each CTA → `communityLink(source)`.

---

## 6. Backend / API Notes

- **`/api/lead`** — accepts name, phone, email, intent (buy/rent/sell/land), budget range, preferred areas, source. Validates with Zod. Sends to email + (optionally) writes to CRM. Rate-limit. Honeypot + turnstile. **Never store raw phone numbers in client-side state beyond the form.**
- **Listings data model (CMS):**
  ```ts
  type Property = {
    id: string
    vertical: "residential" | "land" | "commercial" 
    title, slug, description
    location: { area: string, subArea?: string, coords?: [number,number], isExactPublic: boolean }
    price: { amount: number, currency: "KES"|"USD", period?: "sale"|"month" }
    specs: { beds?, baths?, acreage?, sqm?, titleStatus?: "freehold"|"leasehold", zoning? }
    media: { hero, gallery[], matterportId?, splineSceneUrl? }
    features: string[]
    status: "public" | "off_market" | "members_only"
    isFeatured: boolean
    createdAt, updatedAt
  }
  ```
  - `status: "off_market" | "members_only"` listings render as **teaser cards** (blurred image, "Shared first in the group — join to view") — this is your best conversion asset. Build the teaser card component early.
- **`/api/og`** — dynamic OG images per listing for WhatsApp/social sharing (a listing shared into a WhatsApp chat should look premium).
- **Sitemap + robots + JSON-LD** (`RealEstateListing` schema) — yes, even for a gated community site; the public listings should be SEO-strong, the off-market ones `noindex`.

---

## 7. Motion & 3D — Implementation Rules

- **Lenis** wraps the app (`MotionProvider`). Respect `prefers-reduced-motion`: disable Lenis, parallax, and autoplay; keep opacity fades only.
- **Hero scroll-dolly:** image container `scale(1 → 1.08)` + `opacity` crossfade to interior on scroll via Framer Motion `useScroll`. One transition. 600–900ms feel. Don't chain five.
- **One 3D moment per vertical max.** Use **Spline** embed (lazy-loaded, `loading="lazy"`, poster fallback image, paused when off-screen via IntersectionObserver). Homes vertical: rotating plot/community model. Land vertical: isometric terrain/plot. **Never block LCP** — the 3D scene loads *after* the hero image.
- **Matterport embed** on listing detail (lazy, click-to-load facade with poster + "Enter 3D tour" button — never auto-load an iframe).
- Micro-interactions: card hover lift 4px + copper underline draw; stagger reveals 80–120ms `ease-out-expo`; page transitions 400ms fade + 12px drift. **No bounce, no spin, no autoplay carousels.**
- All decorative motion behind `useReducedMotion()` guards.

---

## 8. Performance & SEO Budget (non-negotiable for premium feel)

- LCP < 2.5s on 4G; CLS < 0.1; INP < 200ms. Premium sites *feel* fast.
- `next/image` everywhere; AVIF/WebP; explicit width/height; blur placeholders.
- Fonts: self-host, `font-display: swap`, subset Latin. Two weights max per family.
- Lazy-load everything below the fold + all 3D/iframe embeds behind click/poster.
- Every public listing: unique title, meta description, OG image, JSON-LD. Location pages (`/communities/karen`) are SEO gold — build them properly with real, useful content (not thin pages).


## 9. Admin / Marketing Ops Requirements (don't skip)

Marketing must be able to do these **without a developer**:

1. **Swap the WhatsApp group link** → env var, one redeploy. (Do this first; group links rotate.)
2. **Change `COMMUNITY_STATUS`** (`founding` → `paid` → `waitlist`) → env var. This flips all urgency copy, badges, and CTA destinations. **Test all three states in staging.**
3. **Update member count / spots cap / paid price** → env vars *or* a CMS "Community Settings" singleton (better — no deploy). Recommend the CMS singleton, with env as fallback.
4. **Add/edit listings, mark off-market, feature a listing** → CMS.
5. **Edit "why join" cards, testimonials, `/join` copy** → CMS blocks.
6. **See conversion events** → analytics dashboard; document event names in a `docs/analytics.md`.


## 10. Build Order (suggested sprints)

1. **Sprint 0 — Foundations:** env setup, `config/site.ts`, design tokens, fonts, Lenis + reduced-motion provider, layout shell, sticky urgency strip (all 3 states), footer w/ social links, floating WhatsApp button.
2. **Sprint 1 — Funnel core:** homepage hero + social proof + "why join" cards + interstitial card component + `/join` page. Ship this *with placeholder listings* — the funnel is the product.
3. **Sprint 2 — Listings:** CMS schema, property grid + filters, listing detail, teaser/off-market card, `/api/lead`, OG images.
4. **Sprint 3 — Verticals:** `/land` (own hero, filters, copy nuance), `/communities/[slug]` SEO pages.
5. **Sprint 4 — Motion/3D polish:** hero scroll-dolly, one Spline moment per vertical, Matterport facade, micro-interactions.
6. **Sprint 5 — Hardening:** perf audit, analytics verification across all 3 community states, reduced-motion pass, SEO, staging QA.


## 11. Definition of Done (per feature)

- Works in all three `COMMUNITY_STATUS` states (test each).
- All links via `config/site.ts`; zero hardcoded URLs.
- Fires correct analytics event with `source`.
- Respects `prefers-reduced-motion`.
- Passes Lighthouse mobile ≥ 90 perf / ≥ 95 a11y.
- Copy is CMS-editable (if it's marketing copy).
- No `NEXT_PUBLIC_` var contains a secret.