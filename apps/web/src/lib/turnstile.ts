const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(secret: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const response = await fetch(VERIFY_URL, {
    method: "POST",
    body: new URLSearchParams({ secret, response: token }),
  });
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
