import { handleStorageCheckRequest } from "@/lib/acquisition/handle-cron";

export const maxDuration = 60;

export function GET(request: Request) {
  return handleStorageCheckRequest(request);
}
