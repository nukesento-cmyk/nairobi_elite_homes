# Morning acquisition job

Every morning this job runs on Vercel and puts a report on the SuperAdmin's dashboard at `/admin`, under Acquisition. There the SuperAdmin chooses who gets it by email, and can send any report to any address. Nothing runs on anyone's computer, so laptops can be off. The SuperAdmin switches research on and off under Acquisition, with no deploy. While it's off, every report is labelled as a test, with no real leads. See "Research" below.

Code is in `apps/web/src/lib/acquisition`, routes are under `apps/web/src/app/api/cron`, and tables start with `acq_` in `apps/web/db/schema.sql`.

## Schedule

Set in `apps/web/vercel.json`, in UTC. Kenya is UTC+3 all year.

| Job | Schedule | Hobby plan fires between | Pro plan fires |
|---|---|---|---|
| `/api/cron/acquisition` | `0 3 * * *` | 06:00 and 06:59 EAT | 06:00 EAT |
| `/api/cron/acquisition-watchdog` | `0 4 * * *` | 07:00 and 07:59 EAT | 07:00 EAT |

Both run the same job. Whichever arrives first does the work, a repeat does nothing, and a later call resumes an unfinished run from the step that stopped. Only the watchdog sends an alert, because it's the last chance that day.

Research runs in three slots before the report, each within one function's 300-second limit: `/api/cron/acquisition-research?slot=1`, `2` and `3`, at `0 0`, `0 1` and `0 2` UTC. On Hobby each can fire up to 59 minutes late, and all finish before the report.

## Research

Each slot searches the web, then reads pages only from domains a person has allowed. Claude reads each page and returns structured facts, with no database or email tools. Code then checks every quote, name, price and contact against the stored page text. Anything not on the page is dropped.

**To run it:**

1. Set `ANTHROPIC_API_KEY`, and `ACQUISITION_HASH_KEY` to a random value of 32 or more characters, then deploy. Never change the hash key afterwards, or opt-outs stop matching.
2. Optionally set `ACQUISITION_DAILY_SPEND_USD`. The default cap is 1 dollar a day across search and Claude. Research uses Claude Haiku 5.5, chosen for cost: an estimated 5 dollars a month at 30 pages a day. Real spend is on each run in `acq_runs`.
3. Sign in as the SuperAdmin and use the switch under Acquisition.

**Switching off** stops new runs at once, and a run in progress stops at its next page. It needs no deploy, and leads already found stay on the dashboard. Each change goes in the audit log.

**Every morning after that, the SuperAdmin:**

1. Reviews new domains at `/admin`, under Acquisition. Read the site's terms first, then choose Allow research, People only or Block. Nothing is read until a domain is allowed, so the first days mostly fill this list.
2. Reviews leads, then approves or rejects each.

**Private individuals are skipped.** A page about a private person keeps no text, and no prospect or contact is saved. This holds until counsel clears it, and changing it needs a code change as well as the `individual_published` rule.

**Approval will refuse leads while contact classes are locked.** Only `owner_submitted` is callable by default. Once counsel clears a class, update it in `acq_contact_class_rules`:

```sql
UPDATE acq_contact_class_rules SET callable = true, updated_by = '<who, on whose advice>'
WHERE contact_class = 'organisation_line';
```

Google Places isn't used yet, and duplicates are matched on website, contact and exact name only.

## Owner form

Owners and their representatives can submit a property at `/list-your-property`. This costs nothing to run, and doesn't depend on research or Claude. It needs `DATABASE_URL` and `ACQUISITION_HASH_KEY`.

- A submission appears under Leads on the dashboard, for approval. The owner's details are saved as `owner_submitted`, the one class callable today.
- Nothing is treated as proof of ownership. The person's role is recorded as their own statement, and documents are checked at onboarding.
- `acq_consents` records the exact wording each person agreed to, its version and when. Change the wording only by adding a new `OWNER_CONSENT_VERSION`.
- Someone on the suppression list who submits sees the normal thank-you, but no lead is created. Recording fresh consent for them is still to be built.
- Set `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to add the security check. Without them, only a hidden trap field and a rate limit stop automated submissions.

**Have an advocate review the consent wording and the privacy policy before relying on this.**

## Calls and opt-outs

Under Acquisition, each approved lead has **Log a call**. It records the outcome, notes, an optional follow-up date, and that the caller told them they can opt out, which is required for any real conversation. Leads with a follow-up due come first, and the morning report counts them.

- **Opt-out on a call:** choose "Asked not to be contacted". All their contacts go on the list straight away, and they leave the call list.
- **Opt-out any other way:** use the Do Not Contact button on the lead, or the Do Not Contact list form if they aren't a lead. Act within 14 days.
- **Do Not Contact can't be undone on the dashboard.** Recording fresh consent is still to be built.
- **Possible duplicates** block approval until someone checks them. Choose "Not a duplicate", or reject the lead if it's really the same one. Merging isn't built.

Only the SuperAdmin can use these today. A caller role and assigned leads are still to be built.

## Onboarding

Once a lead has expressed interest, the SuperAdmin presses **Start onboarding**. The property can't be published until every step is done, whichever role tries.

1. **Create an upload link** and send it to the owner. It works for 7 days, is shown once, and only its hash is stored. Its secret sits after the `#`, so it never reaches server logs or analytics.
2. **Download and check each document**, then mark it checked. Downloads are logged, and always save to disk rather than opening in the page.
3. **Confirm identity**, then **ownership or authority**. Only a checked proof of ownership makes someone a `verified_owner`. Someone with authority stays a `representative`.
4. **Confirm availability, and the price and terms.**
5. **Confirm the signed marketing authority.** This moves the lead to Mandate Secured.
6. **Send for final approval**, with the listing details and who owns the photos. The property goes to Approvals as pending, at the agreed price.
7. **An admin who didn't verify the documents approves it** under Approvals. The database refuses the person who verified them, so this needs a second person.

**Creating the store:** in the Vercel dashboard, open Storage, create a Blob store with Private access, and connect it to this project with the custom prefix `ACQUISITION_BLOB`. Don't use the default prefix, because it would clash with `BLOB_READ_WRITE_TOKEN`, which the public photo store uses. Redeploy afterwards.

**Storage:** documents are encrypted with AES-256-GCM using `ACQUISITION_DOCUMENT_KEY`, then kept in a private Blob store, found through `ACQUISITION_BLOB_STORE_ID`. It signs in with Vercel OIDC, so no long-lived token is stored, and it refuses to run without one rather than fall back to the public photo store. The morning report tests storage every day, and shows "Document storage" as failed if it stops working. Never change the key, or existing documents can't be opened. Keep a copy somewhere safe, because losing it loses the documents.

**Retention:** the morning job deletes documents past their date: 90 days for most, 3 years for signed marketing authorities. Counsel should confirm these periods.

**Files:** PDF, JPG, PNG or WebP, up to 4 MB through the link and 1 MB through the dashboard. The type is read from the file itself. Files aren't virus-scanned, so open them carefully.

## Setup

1. Add these production variables in Vercel:

   | Variable | Value |
   |---|---|
   | `CRON_SECRET` | Random, at least 16 characters. Without it nothing can start the job |
   | `RESEND_API_KEY` | Optional. Without it, reports only appear on the dashboard |
   | `LEAD_EMAIL_FROM` | Optional, needed with the key. An address on a domain verified in Resend. `onboarding@resend.dev` only delivers to the Resend account's own email |
   | `ACQUISITION_ALERT_EMAIL_TO` | Optional. Defaults to the report's recipients |
   | `ACQUISITION_MONITOR_URL` | Optional but recommended. See below |

2. Apply the schema: `DATABASE_URL=<production url> pnpm --filter web db:apply`. It's safe to repeat, and leaves changes people made to source policies and contact rules alone.
3. Deploy to production. Vercel only runs crons on production deployments. Pushing to `main` deploys to production, so add new variables before pushing: a deployment doesn't pick up variables added after it started.
4. Trigger a first run from the Vercel dashboard (Settings, Cron Jobs), or check `/admin` the next morning.
5. Sign in as the SuperAdmin, open Acquisition, and add who should get the report by email.

## Outside monitor

The alert email can't help if Vercel or email itself is down. So create a daily check with a dead-man's-switch service such as Healthchecks.io, put its ping URL in `ACQUISITION_MONITOR_URL`, and have it alert someone's phone if no ping arrives by 08:30 EAT. The ping is only sent after a report is delivered.

## When a report doesn't arrive

```sql
SELECT run_date, status, attempts, started_by, delivered_at, error
FROM acq_runs ORDER BY run_date DESC LIMIT 7;

SELECT step, status, detail, created_at FROM acq_run_events
WHERE run_id = '<id>' ORDER BY id;
```

| What you see | Meaning | Do this |
|---|---|---|
| No row for today | Neither cron reached the job | Check Cron Jobs in Vercel and its logs. A 503 names the missing variables |
| `failed` at `deliver` | Email wasn't accepted. The report is still on the dashboard | Check the Resend dashboard, then re-trigger the watchdog from Vercel |
| `completed`, no `delivered_at` | Email isn't set up, or nobody is chosen to receive it | Read it on the dashboard, or add recipients there |
| `failed` at `database` in the alert | Database unreachable | Check Neon, then re-trigger |
| `running` for over 10 minutes | An attempt was killed | The next trigger takes it over once its lease expires |

## Safety rules enforced by the database

These hold whatever the application code does, and `src/lib/acquisition/acquisition.test.ts` covers each:

- A domain with no `allowed` row is never fetched. Blocked portals stay blocked, including their subdomains and redirects to them.
- Contact classes are locked in `acq_contact_class_rules`. Only `owner_submitted` is callable until an advocate clears the others.
- A prospect can't reach Ready to Call without evidence, a person's approval, a callable contact, no suppression match and no open duplicate.
- Do Not Contact suppresses every contact of that prospect in the same transaction, and can't be undone.
- A property from acquisition can't be approved until onboarding is complete, with two different people verifying and approving.
- The audit log can't be changed, and holds no names or contact details.

## Known limits

- A function can run for up to 300 seconds on Hobby. Each research slot stops at about 230 seconds, and pages it didn't reach wait for the next slot.
- Daily lead volume and cost haven't been measured yet. Three slots may not reach 20 to 30 leads a day.
- `Do Not Contact` has no undo yet. Recording later consent comes in Phase 2.
- The Hobby plan can't promise an exact time. Pro makes these times exact.
