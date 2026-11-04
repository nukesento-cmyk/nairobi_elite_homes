// Addresses of brand sites. No database or server imports, because the proxy uses this too.

/** A host with any port and leading www removed, in lower case. */
export function bareHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

/** The address the main site is served from. Anything else is treated as a brand's domain. */
export function isMainHost(host: string, siteUrl: string | undefined): boolean {
  const bare = bareHost(host);
  if (bare === "localhost" || bare === "127.0.0.1" || bare === "[::1]") return true;
  if (bare.endsWith(".vercel.app")) return true;
  if (!siteUrl) return false;
  try {
    return bare === bareHost(new URL(siteUrl).host);
  } catch {
    return false;
  }
}

export function brandOrigin(domain: string): string {
  return `https://${domain}`;
}

/** The start of every link on a brand's site: nothing on its own domain, /b/slug otherwise. */
export function siteBase(key: string): string {
  return key.includes(".") ? "" : `/b/${key}`;
}

/** Only ever a brand address, so a value sent by a browser can't redirect somewhere else. */
export function parseBase(value: unknown): string {
  return typeof value === "string" && /^\/b\/[a-z0-9-]+$/.test(value) ? value : "";
}

export function slugFromBase(base: string): string | null {
  return base ? base.slice("/b/".length) : null;
}

// --- Signing in with Google from a brand's domain. Google only needs to know the main domain:
// it returns there, and the state says which brand's domain to pass the answer on to.

const RELAY_SEPARATOR = "~";

export function relayState(random: string, host: string): string {
  return `${bareHostKeepWww(host)}${RELAY_SEPARATOR}${random}`;
}

function bareHostKeepWww(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

/** The brand domain a Google answer is meant for, if it's not the one it arrived at. */
export function relayHost(state: string | null, currentHost: string): string | null {
  const separator = state?.indexOf(RELAY_SEPARATOR) ?? -1;
  if (!state || separator < 1) return null;
  const host = state.slice(0, separator);
  return host === bareHostKeepWww(currentHost) ? null : host;
}

/** Where Google sends people back to. Local development is registered with Google separately. */
export function googleRedirectOrigin(requestOrigin: string, siteUrl: string | undefined): string {
  const host = new URL(requestOrigin).host;
  if (!siteUrl || bareHost(host) === "localhost" || bareHost(host) === "127.0.0.1") return requestOrigin;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return requestOrigin;
  }
}
