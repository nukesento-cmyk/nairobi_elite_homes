import { createHash } from "node:crypto";

import type { Db } from "@/lib/admin/accounts";

import { checkSourcePolicy, type Verdict } from "./policy";
import { robotsAllows } from "./robots";

export const RESEARCH_AGENT = "NairobiEliteResearch";
// Says who's asking and where to find out more, so a site owner can object.
const USER_AGENT = `${RESEARCH_AGENT}/1.0${process.env.NEXT_PUBLIC_SITE_URL ? ` (+${process.env.NEXT_PUBLIC_SITE_URL})` : ""}`;

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 15_000;
const MIN_SECONDS_BETWEEN_FETCHES = 10;
const SNAPSHOT_DAYS = 90;

export type FetchOutcome =
  | { outcome: "stored"; sourceRecordId: string; url: string; extract: string }
  | { outcome: "refused"; reason: "policy"; verdict: Verdict | "invalid" }
  | { outcome: "refused"; reason: "robots" | "too_soon" | "too_many_redirects" | "not_text" | "too_large" }
  | { outcome: "stopped"; status: number }
  | { outcome: "failed"; status?: number };

/** Readable text from a page. It's what quotes are later checked against. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function robotsPermit(url: URL, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(new URL("/robots.txt", url), {
      headers: { "user-agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 410) return true;
    // A site that won't say, or says no to the file itself, gets treated as a no.
    if (!response.ok) return false;
    return robotsAllows(await response.text(), RESEARCH_AGENT, url.pathname + url.search);
  } catch {
    return false;
  }
}

async function record(
  db: Db,
  brandId: string,
  policyId: string | null,
  url: string,
  httpStatus: number | null,
  outcome: "stored" | "stopped" | "failed",
  extract: string | null,
): Promise<string> {
  const hash = extract === null ? null : createHash("sha256").update(extract).digest("hex");
  const [row] = await db.query<{ id: string }>(
    `INSERT INTO acq_source_records (brand_id, policy_id, url, http_status, outcome, content_sha256, extract, snapshot_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7::text IS NULL THEN NULL ELSE now() + interval '${SNAPSHOT_DAYS} days' END)
     RETURNING id`,
    [brandId, policyId, url, httpStatus, outcome, hash, extract],
  );
  return row.id;
}

/**
 * The only way the job reads a web page. It doesn't log in, use proxies or solve CAPTCHAs. A
 * site that says no gets logged and left alone, and is never retried by another route.
 */
export async function fetchPage(
  db: Db,
  brandId: string,
  startUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchOutcome> {
  let url = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    // Checked again on every hop, or an approved page could redirect to a blocked one.
    const decision = await checkSourcePolicy(db, brandId, url);
    if (!decision.allowed) return { outcome: "refused", reason: "policy", verdict: decision.verdict };

    const parsed = new URL(url);
    const [recent] = await db.query<{ recent: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM acq_source_records WHERE brand_id = $1 AND policy_id = $2
           AND fetched_at > now() - interval '${MIN_SECONDS_BETWEEN_FETCHES} seconds'
       ) AS recent`,
      [brandId, decision.policyId],
    );
    if (recent.recent && hop === 0) return { outcome: "refused", reason: "too_soon" };

    if (!(await robotsPermit(parsed, fetchImpl))) return { outcome: "refused", reason: "robots" };

    let response: Response;
    try {
      response = await fetchImpl(parsed, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain" },
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      await record(db, brandId, decision.policyId, url, null, "failed", null);
      return { outcome: "failed" };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { outcome: "failed", status: response.status };
      url = new URL(location, parsed).toString();
      continue;
    }

    if (response.status === 401 || response.status === 403 || response.status === 429) {
      await record(db, brandId, decision.policyId, url, response.status, "stopped", null);
      return { outcome: "stopped", status: response.status };
    }

    if (!response.ok) {
      await record(db, brandId, decision.policyId, url, response.status, "failed", null);
      return { outcome: "failed", status: response.status };
    }

    const type = response.headers.get("content-type") ?? "";
    if (!/^text\/(html|plain)/i.test(type)) return { outcome: "refused", reason: "not_text" };

    const body = await response.text();
    if (Buffer.byteLength(body) > MAX_BYTES) return { outcome: "refused", reason: "too_large" };

    const extract = /html/i.test(type) ? htmlToText(body) : body.trim();
    const sourceRecordId = await record(db, brandId, decision.policyId, url, response.status, "stored", extract);
    return { outcome: "stored", sourceRecordId, url, extract };
  }

  return { outcome: "refused", reason: "too_many_redirects" };
}
