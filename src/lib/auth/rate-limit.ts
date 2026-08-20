import { redisTakeToken } from "@/lib/cache/redis-rest";

export type RateBucket =
  | "read"
  | "search"
  | "write"
  | "export"
  | "auth"
  | "optout"
  | "billing"
  | "webhook"
  | "crm";

const WINDOWS: Record<RateBucket, { limit: number; windowMs: number }> = {
  read: { limit: 120, windowMs: 60_000 },
  search: { limit: 40, windowMs: 60_000 },
  write: { limit: 20, windowMs: 60_000 },
  export: { limit: 10, windowMs: 60_000 },
  auth: { limit: 8, windowMs: 60_000 },
  optout: { limit: 5, windowMs: 60_000 },
  billing: { limit: 30, windowMs: 60_000 },
  webhook: { limit: 60, windowMs: 60_000 },
  crm: { limit: 90, windowMs: 60_000 },
};

/** Per-user caps — tighter than IP to limit multi-account abuse. */
const USER_WINDOWS: Record<RateBucket, { limit: number; windowMs: number }> = {
  read: { limit: 180, windowMs: 60_000 },
  search: { limit: 30, windowMs: 60_000 },
  write: { limit: 10, windowMs: 60_000 },
  export: { limit: 8, windowMs: 60_000 },
  auth: { limit: 12, windowMs: 60_000 },
  optout: { limit: 5, windowMs: 60_000 },
  billing: { limit: 20, windowMs: 60_000 },
  webhook: { limit: 60, windowMs: 60_000 },
  crm: { limit: 120, windowMs: 60_000 },
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

async function takeTokenDistributed(
  memKey: string,
  redisKey: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const fromRedis = await redisTakeToken(redisKey, limit, windowSec, now);
  if (fromRedis) return fromRedis;
  return takeToken(memKey, limit, windowMs, now);
}

export async function rateLimit(
  ip: string,
  bucket: RateBucket,
  now = Date.now(),
): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const cfg = WINDOWS[bucket];
  const memKey = `${bucket}:${ip}`;
  const redisKey = `rl:v1:${memKey}`;
  return takeTokenDistributed(memKey, redisKey, cfg.limit, cfg.windowMs, now);
}

export async function rateLimitUser(
  userId: string,
  bucket: RateBucket,
  now = Date.now(),
): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const cfg = USER_WINDOWS[bucket];
  const memKey = `user:${bucket}:${userId}`;
  const redisKey = `rl:v1:${memKey}`;
  return takeTokenDistributed(memKey, redisKey, cfg.limit, cfg.windowMs, now);
}

export function resetRateLimitStore(): void {
  store.clear();
}

export function pruneRateLimitStore(now = Date.now()): void {
  for (const [key, value] of store) {
    if (value.resetAt <= now) store.delete(key);
  }
}
