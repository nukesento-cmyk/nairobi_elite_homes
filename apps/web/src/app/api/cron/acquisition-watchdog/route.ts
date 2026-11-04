import { handleCronRequest } from "@/lib/acquisition/handle-cron";

export const maxDuration = 300;

// Starts the run if the first cron never fired, and resumes it if it stopped part way.
export function GET(request: Request) {
  return handleCronRequest(request, "watchdog");
}
