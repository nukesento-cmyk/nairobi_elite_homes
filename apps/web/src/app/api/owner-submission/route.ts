import { ownerSubmissionSchema } from "@/lib/acquisition/owner-form";
import { saveOwnerSubmission } from "@/lib/acquisition/owner-submission";
import { DEFAULT_BRAND_ID } from "@/lib/brands";
import { db, isDatabaseConfigured } from "@/lib/db";
import { isRateLimited } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

// Mistakes on the form don't use up someone's submissions: only valid ones count towards the lower limit.
const MAX_ATTEMPTS_PER_WINDOW = 30;
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const WINDOW_MS = 60 * 60 * 1000;
const tooMany = () => Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`owner-attempt:${ip}`, MAX_ATTEMPTS_PER_WINDOW, WINDOW_MS)) return tooMany();

  const parsed = ownerSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Please check the form.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;

  // Looks like success, so a bot learns nothing about the honeypot.
  if (input.company) return Response.json({ ok: true });

  if (isRateLimited(`owner-submit:${ip}`, MAX_SUBMISSIONS_PER_WINDOW, WINDOW_MS)) return tooMany();

  const { ACQUISITION_HASH_KEY: hashKey, TURNSTILE_SECRET_KEY: turnstileKey } = process.env;
  if (!hashKey || !isDatabaseConfigured()) {
    console.error("Owner form is not configured: set DATABASE_URL and ACQUISITION_HASH_KEY.");
    return Response.json({ error: "The form isn't available right now." }, { status: 503 });
  }
  if (turnstileKey && !(await verifyTurnstile(turnstileKey, input.turnstileToken))) {
    return Response.json({ error: "Please complete the security check." }, { status: 403 });
  }

  try {
    const result = await saveOwnerSubmission({ db, brandId: DEFAULT_BRAND_ID, hashKey }, input);
    if (result.outcome === "not_kenyan_phone") {
      return Response.json({ error: "Please check the form.", fields: { phone: ["Please enter a Kenyan phone number."] } }, { status: 400 });
    }
    // Someone on the opt-out list sees the same thanks: the response reveals nothing about the list.
    return Response.json({ ok: true });
  } catch (error) {
    // Their details are deliberately left out of the log.
    console.error("Owner submission failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 });
  }
}
