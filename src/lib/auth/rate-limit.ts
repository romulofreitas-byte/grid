export type RateBucket =
  | "read"
  | "search"
  | "write"
  | "export"
  | "auth"
  | "optout"
  | "billing"
  | "webhook";

const WINDOWS: Record<RateBucket, { limit: number; windowMs: number }> = {
  read: { limit: 120, windowMs: 60_000 },
  search: { limit: 40, windowMs: 60_000 },
  write: { limit: 20, windowMs: 60_000 },
  export: { limit: 10, windowMs: 60_000 },
  auth: { limit: 8, windowMs: 60_000 },
  optout: { limit: 5, windowMs: 60_000 },
  billing: { limit: 30, windowMs: 60_000 },
  webhook: { limit: 60, windowMs: 60_000 },
};

type Counter = { count: number; resetAt: number };

const store = new Map<string, Counter>();

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export function takeToken(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: boolean; remaining: number; resetAt: number } {
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return {
    ok: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

export function rateLimit(
  ip: string,
  bucket: RateBucket,
  now = Date.now(),
): { ok: boolean; remaining: number; resetAt: number } {
  const cfg = WINDOWS[bucket];
  return takeToken(`${bucket}:${ip}`, cfg.limit, cfg.windowMs, now);
}

export function resetRateLimitStore(): void {
  store.clear();
}

export function pruneRateLimitStore(now = Date.now()): void {
  for (const [key, value] of store) {
    if (value.resetAt <= now) store.delete(key);
  }
}
