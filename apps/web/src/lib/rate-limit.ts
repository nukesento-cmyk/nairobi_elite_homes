// Counts per server instance, so on serverless hosting this only slows abuse
// down. Turnstile is the main defence; a shared store can replace this if needed.
const hits = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number, now = Date.now()) {
  for (const [storedKey, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(storedKey);
  }

  const entry = hits.get(key);
  if (!entry) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}
