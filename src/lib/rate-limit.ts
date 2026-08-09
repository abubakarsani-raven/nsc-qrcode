const buckets = new Map<string, { count: number; reset: number }>();

/** Simple in-memory IP rate limit for /v/* (single-node on-prem). */
export function rateLimit(ip: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const cur = buckets.get(ip);
  if (!cur || now > cur.reset) {
    buckets.set(ip, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  cur.count += 1;
  if (cur.count > limit) return { ok: false, remaining: 0 };
  return { ok: true, remaining: limit - cur.count };
}
