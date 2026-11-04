import { createHash, timingSafeEqual } from "node:crypto";

import { Resend } from "resend";

import type { DailyJobDeps, SendEmail } from "./daily-job";

const MONITOR_TIMEOUT_MS = 10_000;

/** Fails closed: with no secret set, nothing can start the job. */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}

export function recipients(value: string | undefined): string[] {
  return (value ?? "").split(",").map((address) => address.trim()).filter(Boolean);
}

/** What the job can't run without. Email is optional: reports always reach the dashboard. */
export function missingConfig(env: Record<string, string | undefined>): string[] {
  return ["CRON_SECRET", "DATABASE_URL"].filter((name) => !env[name]);
}

const DEFAULT_DAILY_SPEND_USD = 1;

export type ResearchConfig =
  | { state: "misconfigured"; missing: string[] }
  | { state: "ready"; apiKey: string; hashKey: string; dailySpendCapUsd: number };

/** What research needs to run. Whether it should run is the SuperAdmin's switch in the database. */
export function researchConfig(env: Record<string, string | undefined>): ResearchConfig {
  const missing = ["ANTHROPIC_API_KEY", "ACQUISITION_HASH_KEY"].filter((name) => !env[name]);
  if (missing.length > 0) return { state: "misconfigured", missing };
  const cap = Number(env.ACQUISITION_DAILY_SPEND_USD);
  return {
    state: "ready",
    apiKey: env.ANTHROPIC_API_KEY!,
    hashKey: env.ACQUISITION_HASH_KEY!,
    dailySpendCapUsd: Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_DAILY_SPEND_USD,
  };
}

/** Null until both the key and a sender are set. */
export function emailSender(env: Record<string, string | undefined>): SendEmail | null {
  const { RESEND_API_KEY: apiKey, LEAD_EMAIL_FROM: from } = env;
  if (!apiKey || !from) return null;
  const client = new Resend(apiKey);
  return async ({ subject, html, text, idempotencyKey }, to) => {
    const { error } = await client.emails.send({ from, to, subject, html, text }, { idempotencyKey });
    if (error) throw new Error(error.message);
  };
}

export function monitorPinger(url: string | undefined, fetchImpl: typeof fetch = fetch): DailyJobDeps["pingMonitor"] {
  if (!url) return undefined;
  return async () => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(MONITOR_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Monitor answered ${response.status}`);
  };
}
