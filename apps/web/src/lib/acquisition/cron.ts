import { createHash, timingSafeEqual } from "node:crypto";

import { Resend } from "resend";

import type { DailyJobDeps, Email } from "./daily-job";

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

/** Names of what's missing, so a misconfigured job says so without exposing any values. */
export function missingConfig(env: Record<string, string | undefined>): string[] {
  return ["CRON_SECRET", "DATABASE_URL", "RESEND_API_KEY", "LEAD_EMAIL_FROM", "ACQUISITION_REPORT_EMAIL_TO"].filter((name) => !env[name]);
}

export function resendSender(apiKey: string, from: string, to: string[]): (email: Email) => Promise<void> {
  const client = new Resend(apiKey);
  return async ({ subject, html, text, idempotencyKey }) => {
    const { error } = await client.emails.send({ from, to, subject, html, text }, { idempotencyKey });
    if (error) throw new Error(`Email was not accepted: ${error.message}`);
  };
}

export function monitorPinger(url: string | undefined, fetchImpl: typeof fetch = fetch): DailyJobDeps["pingMonitor"] {
  if (!url) return undefined;
  return async () => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(MONITOR_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Monitor answered ${response.status}`);
  };
}
