import "server-only";

/** The form refuses submissions in production until these exist, so it isn't shown before then. */
export function isLeadFormAvailable(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const { TURNSTILE_SECRET_KEY, RESEND_API_KEY, LEAD_EMAIL_TO, LEAD_EMAIL_FROM } = process.env;
  return Boolean(TURNSTILE_SECRET_KEY && RESEND_API_KEY && LEAD_EMAIL_TO && LEAD_EMAIL_FROM);
}
