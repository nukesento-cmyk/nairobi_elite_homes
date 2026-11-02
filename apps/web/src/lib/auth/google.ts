import { createHash, randomBytes } from "node:crypto";

// Google's fixed sign-in addresses, not links marketing would ever change.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export type GoogleProfile = { sub: string; email: string; name: string };

export type OAuthAttempt = { state: string; nonce: string; verifier: string; audience: "buyer" | "staff" };

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function startAttempt(audience: OAuthAttempt["audience"]): OAuthAttempt {
  return {
    audience,
    state: randomBytes(24).toString("base64url"),
    nonce: randomBytes(24).toString("base64url"),
    verifier: randomBytes(48).toString("base64url"),
  };
}

export function authorizationUrl(attempt: OAuthAttempt, redirectUri: string, clientId: string): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: attempt.state,
    nonce: attempt.nonce,
    code_challenge: createHash("sha256").update(attempt.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/**
 * The token arrives straight from Google over TLS, which OpenID Connect accepts in place of
 * checking its signature. The claims are still checked, so one issued for another app or an
 * earlier attempt is refused. Returns null for anything not usable.
 */
export function profileFromIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string; now?: number },
): GoogleProfile | null {
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const now = expected.now ?? Date.now() / 1000;
  const valid =
    ISSUERS.includes(String(claims.iss)) &&
    claims.aud === expected.clientId &&
    typeof claims.exp === "number" &&
    claims.exp > now &&
    claims.nonce === expected.nonce &&
    claims.email_verified === true &&
    typeof claims.sub === "string" &&
    typeof claims.email === "string";
  if (!valid) return null;
  const email = claims.email as string;
  return {
    sub: claims.sub as string,
    email,
    name: typeof claims.name === "string" && claims.name ? claims.name : email.split("@")[0],
  };
}

export async function exchangeCode(code: string, attempt: OAuthAttempt, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: attempt.verifier,
    }),
  });
  if (!response.ok) return null;
  const { id_token: idToken } = (await response.json()) as { id_token?: string };
  return idToken ? profileFromIdToken(idToken, { clientId, nonce: attempt.nonce }) : null;
}
