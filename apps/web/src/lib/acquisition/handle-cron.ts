import "server-only";

import { DEFAULT_BRAND_ID } from "@/lib/brands";
import { db } from "@/lib/db";

import { createClaudeResearcher } from "./ai";
import { emailSender, isAuthorizedCron, missingConfig, monitorPinger, recipients, researchConfig } from "./cron";
import { DAILY_JOB, runDailyJob } from "./daily-job";
import { runResearchSlot } from "./research";

const noStore = { "cache-control": "no-store" };

/** Leaves about a minute of the 300-second function limit to finish a page and save state. */
const RESEARCH_TIME_BUDGET_MS = 230_000;

/** One research slot. Several run before the morning report, and each stays within one function's limit. */
export async function handleResearchRequest(request: Request): Promise<Response> {
  const env = process.env;
  if (!isAuthorizedCron(request.headers.get("authorization"), env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401, headers: noStore });
  }

  const config = researchConfig(env);
  if (config.state === "off") return Response.json({ status: "off" }, { headers: noStore });
  if (config.state === "misconfigured") {
    console.error(`Acquisition research cannot run. Missing: ${config.missing.join(", ")}`);
    return Response.json({ status: "not_configured", missing: config.missing }, { status: 503, headers: noStore });
  }

  const slot = Number(new URL(request.url).searchParams.get("slot"));
  if (!Number.isInteger(slot) || slot < 1 || slot > 9) return Response.json({ status: "bad_slot" }, { status: 400, headers: noStore });

  const result = await runResearchSlot(
    {
      db,
      brandId: DEFAULT_BRAND_ID,
      researcher: createClaudeResearcher(config.apiKey),
      hashKey: config.hashKey,
      dailySpendCapUsd: config.dailySpendCapUsd,
      timeBudgetMs: RESEARCH_TIME_BUDGET_MS,
    },
    slot,
  );

  if (result.status === "failed") {
    console.error(`Acquisition research slot ${slot} failed at ${result.step}: ${result.error}`);
    return Response.json({ status: result.status, step: result.step }, { status: 500, headers: noStore });
  }
  return Response.json({ status: result.status }, { headers: noStore });
}

/** What the cron and watchdog routes share. They differ only in who started the run. */
export async function handleCronRequest(request: Request, startedBy: "cron" | "watchdog"): Promise<Response> {
  const env = process.env;
  if (!isAuthorizedCron(request.headers.get("authorization"), env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401, headers: noStore });
  }

  const missing = missingConfig(env);
  if (missing.length > 0) {
    console.error(`${DAILY_JOB} cannot run. Missing: ${missing.join(", ")}`);
    return Response.json({ status: "not_configured", missing }, { status: 503, headers: noStore });
  }

  const result = await runDailyJob(
    {
      db,
      brandId: DEFAULT_BRAND_ID,
      sendEmail: emailSender(env),
      researchEnabled: researchConfig(env).state === "on",
      alertTo: recipients(env.ACQUISITION_ALERT_EMAIL_TO),
      pingMonitor: monitorPinger(env.ACQUISITION_MONITOR_URL),
    },
    startedBy,
  );

  if (result.status === "failed") {
    console.error(`${DAILY_JOB} failed at ${result.step}: ${result.error}`);
    return Response.json({ status: result.status, step: result.step }, { status: 500, headers: noStore });
  }
  return Response.json({ status: result.status }, { headers: noStore });
}
