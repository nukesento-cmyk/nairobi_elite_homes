# Admin accounts

Sign in at `/admin`. Website content is still edited in the Sanity Studio.

## What each role can do

| | SuperAdmin | Admin |
|---|---|---|
| See all accounts | Yes | Yes |
| Add an admin | Yes | Yes |
| Edit an admin's name and email | Yes | Yes |
| Change their own password | Yes | Yes |
| Edit the SuperAdmin | Themselves only | No |
| **Delete an admin** | **Yes** | **No** |
| Reset another admin's password | Yes | No |

Nobody can delete the SuperAdmin, and the database allows only one.

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
- Every action rechecks the signed-in account on the server. Hidden buttons aren't what enforce the rules.
