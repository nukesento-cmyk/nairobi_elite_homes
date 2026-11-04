import "server-only";

import { DEFAULT_BRAND_ID } from "@/lib/brands";
import { db } from "@/lib/db";

import { emailSender, isAuthorizedCron, missingConfig, monitorPinger, recipients } from "./cron";
import { DAILY_JOB, runDailyJob } from "./daily-job";

const noStore = { "cache-control": "no-store" };

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
