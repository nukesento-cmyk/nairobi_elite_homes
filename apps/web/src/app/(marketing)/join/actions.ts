"use server";

import { headers } from "next/headers";

import { AdminError } from "@/lib/admin/accounts";
import { createAccessRequest } from "@/lib/access-requests";
import { parseBase } from "@/lib/brand-site";
import { brandIdForVisitor } from "@/lib/brands";
import { db, isDatabaseConfigured } from "@/lib/db";
import { isRateLimited } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export type RequestState = { error?: string; sent?: boolean };

const MAX_REQUESTS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function requestAccess(_: RequestState, form: FormData): Promise<RequestState> {
  // Looks like success, so a bot learns nothing about the honeypot.
  if (form.get("company")) return { sent: true };
  if (!isDatabaseConfigured()) return { error: "Requests aren't open yet. Please message us on WhatsApp." };

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`access:${ip}`, MAX_REQUESTS_PER_WINDOW, WINDOW_MS)) {
    return { error: "Too many requests. Please try again later." };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (secret && !(await verifyTurnstile(secret, String(form.get("cf-turnstile-response") ?? "")))) {
    return { error: "Please complete the security check." };
  }

  try {
    // A request made on a brand's own site goes to that brand's admins.
    await createAccessRequest(
      db,
      {
        name: form.get("name"),
        phone: form.get("phone"),
        email: form.get("email") ?? "",
        message: form.get("message") ?? "",
      },
      await brandIdForVisitor(db, parseBase(form.get("base")), requestHeaders.get("host")),
    );
    return { sent: true };
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    console.error("Saving an access request failed.");
    return { error: "We couldn't send that. Please message us on WhatsApp instead." };
  }
}
