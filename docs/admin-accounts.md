# Accounts and roles

Admins and reviewers add properties at `/admin`, and reviewers write blogs. Once real properties are approved, the sample listings disappear. Sanity remains optional, for marketing copy and any listings kept there.

## Brands

Everything belongs to a brand: staff, users, properties, blogs, WhatsApp groups and requests to join. Only the SuperAdmin stands above brands, and sees all of them. Everyone else only ever sees and changes their own brand. Everything that existed before brands is in the original brand, NairobiEliteHomes.

The SuperAdmin adds a brand under "Brands" at `/admin`, with its domain if it has one and its first admin. That admin signs in with the temporary password shown once, and can then add more admins for the brand.

## Each brand's own site

Every brand except the original has its own public site, with its own name, logo, accent colour, listings, blogs, join requests, contact details and sign-in. No other brand's content appears on it, and it never appears on the main site. Its admins set the logo, colour and contact details under "Your site" at `/admin`. The SuperAdmin can do it under "Site details" on the brand. Changes show straight away, and no deploy is needed.

Until a brand has a domain, its site is at `/b/its-name` on the main site. That address comes from the brand's name when it's created, and stays the same if the brand is renamed.

To put a brand on its own domain:

1. Enter the domain on the brand at `/admin`.
2. Add the domain to the Vercel project (`vercel domains add`, or the project's Domains settings), and point its DNS where Vercel says.

Nothing is needed at Google. Sign-in always goes through the main domain, so Google's sign-in screen shows the main site's address, whichever brand it's for. Keeping it this way also stays under Google's limit of 10 domains before it requires a review.

The main site, NairobiEliteHomes, is unchanged: it's still configured by `NEXT_PUBLIC_` values and Sanity, and has its own pages under `(marketing)`. Brand sites use a simpler set of pages under `app/b/[site]`, without the areas guides, urgency strip or lead form.

## Who can do what

| | SuperAdmin | Admin | Reviewer | Caller | User |
|---|---|---|---|---|---|
| Create and edit **brands** | Yes | No | No | No | No |
| Create **admins** | Any brand | Own brand | No | No | No |
| Edit, delete and reset **admins** | Any brand | Ones they added | No | No | No |
| Create, edit, delete and reset **reviewers** | Any brand | Own brand | No | No | No |
| Create, delete and reset **users** | Any brand | Own brand | Own brand | No | No |
| Add and remove **WhatsApp groups** | Any brand | Own brand | No | No | No |
| Add and edit **properties** | No | Own brand, live at once | Own brand, needs approval | No | No |
| Write **blogs** | No | No | Own brand | No | No |
| **Approve** or send back properties and blogs | Any brand | Own brand | No | No | No |
| **Remove** a property | Any brand | Own brand | Own brand | No | No |
| **Remove** a blog | Any brand | No | Own brand | No | No |
| See and handle **community link requests** | Any brand | Own brand | No | No | No |
| Change a brand's **site details** | Any brand | Own brand | No | No | No |
| See **acquisition reports** and choose who gets them | Yes | No | No | No | No |
| See the **call list**, log calls and record **opt-outs** | Yes | No | No | Main brand | No |
| Create, delete and reset **callers** | Main brand | Main brand | No | No | No |
| Change their own name, email and password | Yes | Yes | Yes | Password only | Password only |

Nobody can delete the SuperAdmin, and the database allows only one. An admin can't remove whoever added them. An email can only belong to one user, across all brands, so adding someone who already has an account in another brand is refused. Brands can't be deleted yet.

## Approval

Nothing a reviewer adds appears on the site until an admin or the SuperAdmin approves it. Sending it back includes a note, which the reviewer sees. Editing something already live takes it off the site until it's approved again, so approval can't be sidestepped by changing it afterwards.

## The private community

While `NEXT_PUBLIC_COMMUNITY_STATUS` is `closed`, the group link isn't anywhere on the site. People ask for it with the form on `/join`, and a free account gives no access. Requests appear in `/admin` under "Requests to join". Each of the brand's WhatsApp groups adds a "Send link" button, which opens a chat with that person with the invite already typed. Check it and send it, then choose "Mark link sent". Requests hold personal details, so delete them once they're no longer needed.

## The off-market count

The homepage counts approved off-market and members-only listings itself, and shows nothing while there are none. There's no number to type in.

## Bread

Money on the dashboard is called bread. The headline figure is an estimate: requests not declined, multiplied by the monthly price (`NEXT_PUBLIC_COMMUNITY_PAID_PRICE_KES` or Community Settings). No payments are collected, so it isn't income.

## Signing in

- **Users** sign in at `/login`, with Google or with an email and password. If Google fails for any reason, they come back to `/login` and are asked to use their password.
- Staff or the SuperAdmin can create a user, who gets a temporary password shown once and must replace it at first sign-in. A lost password is reset by staff, since there's no email reset yet.
- Anyone can also create a free account with Google. If the Google email matches an account staff created, it links to that account.
- Someone added under **Users** can't use the staff login: it says their email and password don't match. Add your team under Staff accounts instead, with a role such as Caller.
- **Staff** sign in at `/admin`, with Google or a password. Google only works for an email someone has already added as staff.

To turn on Google sign-in:

1. In Google Cloud Console, create an OAuth client of type "Web application". Google requires 2-step verification on the account first.
2. Add these authorised redirect URIs, using your real domain:
   - `https://nairobi-elite-homes.vercel.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
3. Under Branding, add the home page and `/privacy` links. Then, under Audience, publish the app. While it's in "Testing", only listed test users can sign in. Don't upload a logo unless you're ready for Google's review.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel and in `apps/web/.env.local`, then redeploy. They're secrets: never add a `NEXT_PUBLIC_` prefix.

## Photos

Reviewers and admins upload photos at `/admin`. They're shrunk to at most 2000px in the browser first, then stored in Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Files there can be opened by anyone who has the exact link, so an off-market photo's link is never sent to the public site, but don't share it either.

## First-time setup

1. Create a Postgres database, for example Neon through the Vercel Marketplace, and set `DATABASE_URL` in Vercel and in `apps/web/.env.local`. It is a secret: never add a `NEXT_PUBLIC_` prefix.
2. Add these to `apps/web/.env.local`:
   ```
   SEED_SUPERADMIN_EMAIL="owner@example.com"
   SEED_ADMIN_1_EMAIL="first@example.com"
   SEED_ADMIN_2_EMAIL="second@example.com"
   ```
3. Run `pnpm seed-admins` from the project root. It creates the tables and accounts and prints each temporary password once. Share them privately.
4. Each person signs in and is made to choose their own password, of at least 12 characters, before anything else.

Running the seed also upgrades the database to the latest tables. Run it before deploying a version that needs them. Running it again is safe: existing accounts and passwords are left alone. Remove a deleted admin's email from the `SEED_` values first, or the seed will create them again.

## Safeguards

- Passwords are hashed with scrypt, and only a hash of each session token is stored.
- Sessions last 12 hours. Deleting an admin or resetting their password signs them out immediately.
- Ten wrong passwords lock an account for 15 minutes.
- Google sign-in checks the token was issued to this site, for this attempt, with a verified email.
- Every action rechecks the signed-in account on the server. Hidden buttons aren't what enforce the rules.
