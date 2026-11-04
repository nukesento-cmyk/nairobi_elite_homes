import { handleCronRequest } from "@/lib/acquisition/handle-cron";

export const maxDuration = 300;

export function GET(request: Request) {
  return handleCronRequest(request, "cron");
}
