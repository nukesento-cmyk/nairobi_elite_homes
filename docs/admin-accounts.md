# Accounts and roles

Reviewers add properties and blogs at `/admin`. Once real properties are approved, the sample listings disappear. Sanity remains optional, for marketing copy and any listings kept there.

## Who can do what

| | SuperAdmin | Admin | Reviewer | Buyer |
|---|---|---|---|---|
| Create, edit, delete and reset **admins** | Yes | No | No | No |
| Create, edit, delete and reset **reviewers** | Yes | Yes | No | No |
| Add and edit **properties and blogs** | No | No | Yes | No |
| **Approve** or send back properties and blogs | Yes | Yes | No | No |
| **Remove** a property or blog | Yes | No | Yes | No |
| See and handle **community link requests** | Yes | Yes | No | No |
| Change their own name, email and password | Yes | Yes | Yes | Google account |

Nobody can delete the SuperAdmin, and the database allows only one.

## Approval

Nothing a reviewer adds appears on the site until an admin or the SuperAdmin approves it. Sending it back includes a note, which the reviewer sees. Editing something already live takes it off the site until it's approved again, so approval can't be sidestepped by changing it afterwards.

## The private community

While `NEXT_PUBLIC_COMMUNITY_STATUS` is `closed`, the group link isn't anywhere on the site. People ask for it with the form on `/join`, and a free account gives no access. Requests appear in `/admin` under "Community link requests". "Open WhatsApp" starts a chat with that person: paste the group link there, then choose "Mark link sent". Requests hold personal details, so delete them once they're no longer needed.

## The off-market count

The homepage counts approved off-market and members-only listings itself, and shows nothing while there are none. There's no number to type in.

## Signing in

- **Buyers** use "Continue with Google" at `/account`. There's no password, and no second step.
- **Staff** sign in at `/admin`, with Google or a password. Google only works for an email someone has already added as staff.

To turn on Google sign-in:

1. In Google Cloud Console, create an OAuth client of type "Web application".
2. Add these authorised redirect URIs, using your real domain:
   - `https://nairobi-elite-homes.vercel.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel and in `apps/web/.env.local`. They're secrets: never add a `NEXT_PUBLIC_` prefix.

## Photos

Reviewers upload photos at `/admin`. They're shrunk to at most 2000px in the browser first, then stored in Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Files there can be opened by anyone who has the exact link, so an off-market photo's link is never sent to the public site, but don't share it either.

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

Running the seed again is safe: existing accounts and passwords are left alone. Remove a deleted admin's email from the `SEED_` values first, or the seed will create them again.

## Safeguards

- Passwords are hashed with scrypt, and only a hash of each session token is stored.
- Sessions last 12 hours. Deleting an admin or resetting their password signs them out immediately.
- Ten wrong passwords lock an account for 15 minutes.
- Google sign-in checks the token was issued to this site, for this attempt, with a verified email.
- Every action rechecks the signed-in account on the server. Hidden buttons aren't what enforce the rules.
