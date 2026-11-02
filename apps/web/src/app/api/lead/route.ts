import { Resend } from "resend";

import { site } from "@/config/site";
import { clickedJoinSchema, leadSchema, type Lead } from "@/lib/lead-schema";
import { isRateLimited } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const MAX_LEADS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_JOIN_CLICKS_PER_WINDOW = 60;

function formatLead(lead: Lead): string {
  return [
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
    `Email: ${lead.email}`,
    `Intent: ${lead.intent}`,
    `Budget: ${lead.budget ?? "Not given"}`,
    `Areas: ${lead.areas.length > 0 ? lead.areas.join(", ") : "Not given"}`,
    `Source: ${lead.source}`,
    `Listing: ${lead.listing ?? "None"}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const body: unknown = await request.json().catch(() => null);

  // Counted apart from leads, so clicking around can't use up someone's form attempts.
  const click = clickedJoinSchema.safeParse(body);
  if (click.success) {
    if (isRateLimited(`join:${ip}`, MAX_JOIN_CLICKS_PER_WINDOW, WINDOW_MS)) {
      return new Response(null, { status: 429 });
    }
    // Server-side, so ad blockers can't hide it. The IP is deliberately left out.
    console.info("clicked_join", { ...click.data, status: site.community.status });
    return new Response(null, { status: 204 });
  }

  if (isRateLimited(ip, MAX_LEADS_PER_WINDOW, WINDOW_MS)) {
    return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Please check the form.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const lead = parsed.data;

  // Looks like success, so a bot learns nothing about the honeypot.
  if (lead.company) return Response.json({ ok: true });

  const isProduction = process.env.NODE_ENV === "production";
  const { TURNSTILE_SECRET_KEY, RESEND_API_KEY, LEAD_EMAIL_TO, LEAD_EMAIL_FROM } = process.env;
  const canSendEmail = RESEND_API_KEY && LEAD_EMAIL_TO && LEAD_EMAIL_FROM;

  // A form that isn't wired up must fail visibly, not silently lose the lead.
  if (isProduction && (!TURNSTILE_SECRET_KEY || !canSendEmail)) {
    console.error("Lead form is not configured: set the Turnstile and email variables.");
    return Response.json({ error: "The form isn't available right now." }, { status: 503 });
  }

  if (TURNSTILE_SECRET_KEY && !(await verifyTurnstile(TURNSTILE_SECRET_KEY, lead.turnstileToken))) {
    return Response.json({ error: "Please complete the security check." }, { status: 403 });
  }

  if (!canSendEmail) {
    // Development only. Contact details are deliberately left out of the log.
    console.info("Lead received, email not configured:", { intent: lead.intent, source: lead.source });
    return Response.json({ ok: true });
  }

  const { error } = await new Resend(RESEND_API_KEY).emails.send({
    from: LEAD_EMAIL_FROM,
    to: LEAD_EMAIL_TO,
    replyTo: lead.email,
    subject: `New ${lead.intent} lead from ${lead.source}`,
    text: formatLead(lead),
  });
  if (error) {
    console.error("Lead email failed:", error.name);
    return Response.json({ error: "We couldn't send that. Please try again." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
