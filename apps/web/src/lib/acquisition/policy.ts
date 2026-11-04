import type { Db } from "@/lib/admin/accounts";

export type Verdict = "pending" | "allowed" | "human_only" | "blocked";

export type PolicyDecision = {
  allowed: boolean;
  verdict: Verdict | "invalid";
  domain: string | null;
  policyId: string | null;
};

/** The host of a URL the job could fetch, or null for anything that isn't a public web address. */
export function publicHost(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // Bare IPs and single-label names can reach internal services, and no one approves those.
  if (!host.includes(".") || host.startsWith("[") || /^[\d.]+$/.test(host)) return null;
  return host;
}

/** example.co.ke for www.sales.example.co.ke, trying the most specific first. */
function domainsToCheck(host: string): string[] {
  const parts = host.split(".");
  return parts.slice(0, -1).map((_, i) => parts.slice(i).join("."));
}

/**
 * The one gate in front of every fetch. Only an explicit "allowed" row passes. A domain nobody
 * has looked at yet is queued for a person, and stays closed until they decide.
 */
export async function checkSourcePolicy(db: Db, brandId: string, rawUrl: string): Promise<PolicyDecision> {
  const host = publicHost(rawUrl);
  if (!host) return { allowed: false, verdict: "invalid", domain: null, policyId: null };
  return checkHostPolicy(db, brandId, host);
}

export async function checkHostPolicy(db: Db, brandId: string, host: string): Promise<PolicyDecision> {
  const candidates = domainsToCheck(host);
  const placeholders = candidates.map((_, i) => `$${i + 2}`).join(", ");
  const rows = await db.query<{ id: string; domain: string; verdict: Verdict }>(
    `SELECT id, domain, verdict FROM acq_source_policies WHERE brand_id = $1 AND domain IN (${placeholders})`,
    [brandId, ...candidates],
  );

  // A block on a parent domain beats anything below it. Otherwise the closest match decides.
  const blocked = rows.find((row) => row.verdict === "blocked");
  const match = blocked ?? candidates.map((domain) => rows.find((row) => row.domain === domain)).find(Boolean);
  if (match) {
    return { allowed: match.verdict === "allowed", verdict: match.verdict, domain: match.domain, policyId: match.id };
  }

  const domain = host.replace(/^www\./, "");
  await db.query(
    `INSERT INTO acq_source_policies (brand_id, domain, verdict, updated_by) VALUES ($1, $2, 'pending', 'research-job')
     ON CONFLICT (brand_id, domain) DO NOTHING`,
    [brandId, domain],
  );
  return { allowed: false, verdict: "pending", domain, policyId: null };
}
