import { createHmac } from "node:crypto";

import type { Db } from "@/lib/admin/accounts";

import type { Researcher } from "./ai";
import { fetchPage } from "./fetcher";
import { checkSourcePolicy, publicHost } from "./policy";
import { nairobiDate, runJob, type RunResult } from "./runner";
import { chooseCampaign, openingScript, PRIORITY_AREAS, scoreLead } from "./score";
import { isResearchEnabled } from "./settings";
import { verifyExtraction, type VerifiedLead } from "./verify";

/** Stops discovery and research for the day at this many qualified leads, per the brief. */
const DAILY_LEAD_CAP = 30;
const MIN_PAGE_CHARS = 200;
const QUERIES_PER_SLOT = 2;

const QUERY_TEMPLATES = [
  "new apartments for sale {area} Nairobi property developer",
  "property management company {area} Nairobi",
  "commercial office space to let {area} Nairobi building",
  "off-plan residential development {area} Nairobi developer",
  "real estate investment company portfolio {area} Nairobi",
];

export type ResearchDeps = {
  db: Db;
  brandId: string;
  researcher: Researcher;
  /** Keys the hashes compared against the suppression list. */
  hashKey: string;
  dailySpendCapUsd: number;
  /** Must finish before the function limit, leaving time to save the run's state. */
  timeBudgetMs: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export function hashContact(key: string, kind: string, value: string): string {
  return createHmac("sha256", key).update(`${kind}:${value}`).digest("hex");
}

export function canonicalUrl(raw: string): string | null {
  if (!publicHost(raw)) return null;
  const url = new URL(raw);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  for (const name of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(name)) url.searchParams.delete(name);
  }
  return url.toString().replace(/\/$/, "");
}

/** Different areas and kinds of prospect each slot, so a week covers all of them. */
export function queriesFor(runDate: string, slot: number): string[] {
  const day = Math.floor(Date.parse(`${runDate}T00:00:00Z`) / 86_400_000);
  return Array.from({ length: QUERIES_PER_SLOT }, (_, i) => {
    const turn = day * 3 + slot * QUERIES_PER_SLOT + i;
    const template = QUERY_TEMPLATES[turn % QUERY_TEMPLATES.length];
    return template.replace("{area}", PRIORITY_AREAS[turn % PRIORITY_AREAS.length]);
  });
}

async function spentToday(db: Db, brandId: string, runDate: string): Promise<number> {
  const [row] = await db.query<{ spent: string }>(
    `SELECT COALESCE(SUM(spend_usd), 0)::text AS spent FROM acq_runs WHERE brand_id = $1 AND run_date = $2::text::date`,
    [brandId, runDate],
  );
  return Number(row.spent);
}

async function qualifiedToday(db: Db, brandId: string, runDate: string): Promise<number> {
  const [row] = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM acq_candidates WHERE brand_id = $1 AND status = 'qualified'
       AND ((processed_at AT TIME ZONE 'UTC') + interval '3 hours')::date = $2::text::date`,
    [brandId, runDate],
  );
  return Number(row.count);
}

/**
 * Stores a verified lead. Exact matches on website attach to the existing prospect, and a
 * similar one goes to a person to resolve. Nothing merges on its own.
 */
export async function saveLead(
  deps: Pick<ResearchDeps, "db" | "brandId" | "hashKey">,
  lead: VerifiedLead,
  sourceRecordId: string,
  sourceHost: string,
  today: string,
  /** For a lead that didn't come from a website: how it's recognised, and what was said by whom. */
  origin?: { canonicalKey: string; authorityStatus: string; script: string },
): Promise<string | null> {
  const { db, brandId, hashKey } = deps;
  const domain = sourceHost.replace(/^www\./, "");

  const rules = await db.query<{ contact_class: string }>(
    `SELECT contact_class FROM acq_contact_class_rules WHERE brand_id = $1 AND callable`,
    [brandId],
  );
  const { score, breakdown } = scoreLead(lead, rules.map((rule) => rule.contact_class), today);
  const campaign = chooseCampaign(lead);

  const [saved] = await db.query<{ id: string; status: string }>(
    `INSERT INTO acq_prospects (brand_id, display_name, prospect_type, category, owner_rep_class, campaign, score, score_breakdown, opening_script, canonical_key, authority_status, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb, $9, $10, $11, 'research-job')
     ON CONFLICT (brand_id, canonical_key) DO UPDATE SET score = GREATEST(acq_prospects.score, EXCLUDED.score), updated_by = 'research-job'
     RETURNING id, status`,
    [
      brandId, lead.name, lead.prospectType, lead.category, lead.role, campaign, score, JSON.stringify(breakdown),
      origin?.script ?? openingScript(lead, campaign, domain),
      origin?.canonicalKey ?? `org:${domain}`,
      origin?.authorityStatus ?? "unverified",
    ],
  );
  // Someone asked not to be contacted, so nothing new is added to their record.
  if (saved.status === "do_not_contact") return null;

  for (const item of lead.evidence) {
    await db.query(
      `INSERT INTO acq_evidence (brand_id, prospect_id, claim_type, quote, source_record_id)
       SELECT $1, $2, $3, $4, $5 WHERE NOT EXISTS (SELECT 1 FROM acq_evidence WHERE prospect_id = $2 AND quote = $4)`,
      [brandId, saved.id, item.claimType, item.quote, sourceRecordId],
    );
  }

  await db.query(
    `INSERT INTO acq_opportunities (brand_id, prospect_id, area, location_text, property_type, intent, asking_amount, asking_currency, source_record_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [brandId, saved.id, lead.area, lead.locationText, lead.propertyType, lead.intent, lead.askingAmount, lead.askingCurrency, sourceRecordId],
  );

  for (const contact of lead.contacts) {
    const hash = hashContact(hashKey, contact.kind, contact.value);
    const [suppressed] = await db.query(`SELECT 1 FROM acq_suppression WHERE value_hash = $1`, [hash]);
    if (suppressed) continue;

    const [added] = await db.query<{ id: string }>(
      `INSERT INTO acq_contacts (brand_id, prospect_id, kind, normalised_value, value_hash, contact_class, source_record_id, verified_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), 'research-job')
       ON CONFLICT (brand_id, kind, normalised_value) DO NOTHING RETURNING id`,
      [brandId, saved.id, contact.kind, contact.value, hash, contact.contactClass, sourceRecordId],
    );
    if (!added) {
      // The same contact on a different prospect is a likely duplicate.
      await db.query(
        `INSERT INTO acq_duplicate_candidates (brand_id, prospect_id, possible_match_id, reason)
         SELECT $1, $2, c.prospect_id, 'Shares a contact' FROM acq_contacts c
         WHERE c.brand_id = $1 AND c.kind = $3 AND c.normalised_value = $4 AND c.prospect_id <> $2
         ON CONFLICT (prospect_id, possible_match_id) DO NOTHING`,
        [brandId, saved.id, contact.kind, contact.value],
      );
    }
  }

  await db.query(
    `INSERT INTO acq_duplicate_candidates (brand_id, prospect_id, possible_match_id, reason)
     SELECT $1, $2, p.id, 'Same name' FROM acq_prospects p
     WHERE p.brand_id = $1 AND p.id <> $2 AND lower(p.display_name) = lower($3)
     ON CONFLICT (prospect_id, possible_match_id) DO NOTHING`,
    [brandId, saved.id, lead.name],
  );

  if (saved.status === "new") {
    await db.query(`UPDATE acq_prospects SET status = 'researched', updated_by = 'research-job' WHERE id = $1`, [saved.id]);
  }
  return saved.id;
}

/**
 * One research slot: finds pages, then reads as many approved ones as time and money allow.
 * The cron runs several slots before the report. Unread pages simply wait for the next one.
 */
export async function runResearchSlot(deps: ResearchDeps, slot: number): Promise<RunResult | { status: "off" }> {
  const { db, brandId, researcher } = deps;
  // Off leaves no record of a run, so switching back on the same day can still use this slot.
  if (!(await isResearchEnabled(db, brandId))) return { status: "off" };

  const now = deps.now ?? (() => new Date());
  const runDate = nairobiDate(now());
  const job = `research-slot-${slot}`;
  const started = now().getTime();

  const addSpend = (usd: number) =>
    db.query(
      `UPDATE acq_runs SET spend_usd = spend_usd + $1 WHERE brand_id = $2 AND job = $3 AND run_date = $4::text::date`,
      [usd, brandId, job, runDate],
    );
  const canSpend = async () => (await spentToday(db, brandId, runDate)) < deps.dailySpendCapUsd;
  const finish = async (status: string, id: string, reason: string | null) => {
    await db.query(`UPDATE acq_candidates SET status = $1, reason = $2, processed_at = now() WHERE id = $3`, [status, reason, id]);
  };

  return runJob(db, { brandId, job, runDate, startedBy: "cron" }, [
    {
      name: "discover",
      run: async () => {
        if (await qualifiedToday(db, brandId, runDate) >= DAILY_LEAD_CAP) return { skipped: "daily_cap" };

        const closed = await db.query<{ domain: string }>(
          `SELECT domain FROM acq_source_policies WHERE brand_id = $1 AND verdict IN ('blocked', 'human_only')`,
          [brandId],
        );
        const blocked = closed.map((row) => row.domain);

        let found = 0;
        let dropped = 0;
        let added = 0;
        for (const query of queriesFor(runDate, slot)) {
          if (!(await isResearchEnabled(db, brandId))) return { found, dropped, added, stopped: "switched_off" };
          if (!(await canSpend())) return { found, dropped, added, stopped: "spend_cap" };
          const { results, costUsd } = await researcher.search(query, blocked);
          await addSpend(costUsd);

          for (const result of results) {
            found += 1;
            const url = canonicalUrl(result.url);
            const decision = url ? await checkSourcePolicy(db, brandId, url) : null;
            // Results on closed domains are dropped here too, in case the search let one through.
            if (!url || !decision || decision.verdict === "blocked" || decision.verdict === "human_only" || decision.verdict === "invalid") {
              dropped += 1;
              continue;
            }
            const rows = await db.query(
              `INSERT INTO acq_candidates (brand_id, url, domain, title, search_query) VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (brand_id, url) DO NOTHING RETURNING id`,
              [brandId, url, decision.domain, result.title.slice(0, 300), query],
            );
            added += rows.length;
          }
        }
        return { found, dropped, added };
      },
    },
    {
      name: "research",
      run: async () => {
        const counts = { read: 0, qualified: 0, no_lead: 0, people_skipped: 0, refused: 0, waiting: 0 };
        const queue = await db.query<{ id: string; url: string; domain: string }>(
          `SELECT id, url, domain FROM acq_candidates WHERE brand_id = $1 AND status = 'queued' ORDER BY discovered_at LIMIT 200`,
          [brandId],
        );

        for (const candidate of queue) {
          // Checked for every page, so switching off takes effect part way through a run.
          if (!(await isResearchEnabled(db, brandId))) return { ...counts, stopped: "switched_off" };
          if (now().getTime() - started > deps.timeBudgetMs) return { ...counts, stopped: "time" };
          if (!(await canSpend())) return { ...counts, stopped: "spend_cap" };
          if (await qualifiedToday(db, brandId, runDate) >= DAILY_LEAD_CAP) return { ...counts, stopped: "daily_cap" };

          const page = await fetchPage(db, brandId, candidate.url, deps.fetchImpl);
          if (page.outcome === "refused") {
            const stillWaiting = (page.reason === "policy" && page.verdict === "pending") || page.reason === "too_soon";
            if (stillWaiting) {
              counts.waiting += 1;
            } else {
              counts.refused += 1;
              await finish("refused", candidate.id, page.reason);
            }
            continue;
          }
          if (page.outcome === "stopped" || page.outcome === "failed") {
            counts.refused += 1;
            await finish(page.outcome, candidate.id, page.status ? `HTTP ${page.status}` : null);
            continue;
          }

          counts.read += 1;
          const discard = () => db.query(`SELECT acq_discard_source_text($1::uuid)`, [page.sourceRecordId]);
          if (page.extract.length < MIN_PAGE_CHARS) {
            await discard();
            await finish("no_lead", candidate.id, "Page has too little text.");
            counts.no_lead += 1;
            continue;
          }

          const { extraction, costUsd } = await researcher.extract(page.url, page.extract);
          await addSpend(costUsd);

          const verdict = extraction ? verifyExtraction(page.extract, extraction, runDate) : ({ outcome: "no_lead", reason: "No usable answer." } as const);
          if (verdict.outcome === "person") {
            await discard();
            await finish("person_skipped", candidate.id, null);
            counts.people_skipped += 1;
          } else if (verdict.outcome === "no_lead") {
            await discard();
            await finish("no_lead", candidate.id, verdict.reason);
            counts.no_lead += 1;
          } else {
            const host = publicHost(page.url) ?? candidate.domain;
            const saved = await saveLead(deps, verdict.lead, page.sourceRecordId, host, runDate);
            await finish(saved ? "qualified" : "no_lead", candidate.id, saved ? null : "On the Do Not Contact list.");
            if (saved) counts.qualified += 1;
            else counts.no_lead += 1;
          }
        }
        return counts;
      },
    },
  ]);
}
