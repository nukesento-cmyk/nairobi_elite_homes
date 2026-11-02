"use server";

import { headers } from "next/headers";

import { AdminError } from "@/lib/admin/accounts";
import { createAccessRequest } from "@/lib/access-requests";
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

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`access:${ip}`, MAX_REQUESTS_PER_WINDOW, WINDOW_MS)) {
    return { error: "Too many requests. Please try again later." };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (secret && !(await verifyTurnstile(secret, String(form.get("cf-turnstile-response") ?? "")))) {
    return { error: "Please complete the security check." };
  }

  try {
    await createAccessRequest(db, {
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email") ?? "",
      message: form.get("message") ?? "",
    });
    return { sent: true };
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    console.error("Saving an access request failed.");
    return { error: "We couldn't send that. Please message us on WhatsApp instead." };
  }
}
