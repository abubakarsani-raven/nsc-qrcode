const buckets = new Map<string, { count: number; reset: number }>();
let lastSweep = 0;

/**
 * Simple in-memory IP rate limit for /v/*. Per-instance only: on serverless
 * each instance counts separately, so treat it as abuse damping, not a quota.
 */
export function rateLimit(ip: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  // Drop expired buckets now and then so the map can't grow without bound.
  if (now - lastSweep > windowMs) {
    lastSweep = now;
    for (const [key, b] of buckets) if (now > b.reset) buckets.delete(key);
  }
  const cur = buckets.get(ip);
  if (!cur || now > cur.reset) {
    buckets.set(ip, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  cur.count += 1;
  if (cur.count > limit) return { ok: false, remaining: 0 };
  return { ok: true, remaining: limit - cur.count };
}
