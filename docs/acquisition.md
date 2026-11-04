# Morning acquisition job

Every morning this job runs on Vercel and puts a report on the SuperAdmin's dashboard at `/admin`, under Acquisition. There the SuperAdmin chooses who gets it by email, and can send any report to any address. Nothing runs on anyone's computer, so laptops can be off. Phase 1 proves the schedule and delivery only: it does no research, and every report is labelled as a test, with no real leads.

Code is in `apps/web/src/lib/acquisition`, routes are under `apps/web/src/app/api/cron`, and tables start with `acq_` in `apps/web/db/schema.sql`.

## Schedule

Set in `apps/web/vercel.json`, in UTC. Kenya is UTC+3 all year.

| Job | Schedule | Hobby plan fires between | Pro plan fires |
|---|---|---|---|
| `/api/cron/acquisition` | `0 3 * * *` | 06:00 and 06:59 EAT | 06:00 EAT |
| `/api/cron/acquisition-watchdog` | `0 4 * * *` | 07:00 and 07:59 EAT | 07:00 EAT |

Both run the same job. Whichever arrives first does the work, a repeat does nothing, and a later call resumes an unfinished run from the step that stopped. Only the watchdog sends an alert, because it's the last chance that day.

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

- A function can run for up to 300 seconds here. Phase 3's research may take longer, so it has to work in batches that resume between calls.
- `Do Not Contact` has no undo yet. Recording later consent comes in Phase 2.
- The Hobby plan can't promise an exact time. Pro makes these times exact.
