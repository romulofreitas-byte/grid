import { upstashCommand } from "@/lib/cache/redis-rest";

export const COUNT_INFLIGHT_MAX = 4;
export const COUNT_SLOT_WAIT_MS = 20_000;
export const COUNT_LOCK_TTL_SEC = 45;

const INFLIGHT_KEY = "count:inflight";

type MemCounter = { n: number; expiresAt: number };
type MemLock = { expiresAt: number };

const globalForSlots = globalThis as typeof globalThis & {
  __gridCountInflight?: MemCounter;
  __gridCountLocks?: Map<string, MemLock>;
};

function inflightMem(): MemCounter {
  const now = Date.now();
  const cur = globalForSlots.__gridCountInflight;
  if (!cur || cur.expiresAt <= now) {
    globalForSlots.__gridCountInflight = {
      n: 0,
      expiresAt: now + COUNT_LOCK_TTL_SEC * 1000,
    };
  }
  return globalForSlots.__gridCountInflight!;
}

function locksMem(): Map<string, MemLock> {
  if (!globalForSlots.__gridCountLocks) {
    globalForSlots.__gridCountLocks = new Map();
  }
  return globalForSlots.__gridCountLocks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function redisIncrExpire(key: string, ttlSec: number): Promise<number | null> {
  const n = await upstashCommand<number>(["INCR", key]);
  if (n == null) return null;
  await upstashCommand(["EXPIRE", key, ttlSec]);
  return Number(n);
}

export async function tryAcquireCountSlot(
  max = COUNT_INFLIGHT_MAX,
): Promise<boolean> {
  const redisN = await redisIncrExpire(INFLIGHT_KEY, COUNT_LOCK_TTL_SEC);
  if (redisN != null) {
    if (redisN > max) {
      await upstashCommand(["DECR", INFLIGHT_KEY]);
      return false;
    }
    return true;
  }

  const mem = inflightMem();
  if (mem.n >= max) return false;
  mem.n += 1;
  mem.expiresAt = Date.now() + COUNT_LOCK_TTL_SEC * 1000;
  return true;
}

export async function releaseCountSlot(): Promise<void> {
  const redisN = await upstashCommand<number>(["DECR", INFLIGHT_KEY]);
  if (redisN != null) {
    if (Number(redisN) < 0) await upstashCommand(["SET", INFLIGHT_KEY, "0"]);
    return;
  }
  const mem = inflightMem();
  mem.n = Math.max(0, mem.n - 1);
}

export async function withCountSlot<T>(
  fn: () => Promise<T>,
  opts?: { max?: number; waitMs?: number; pollMs?: number },
): Promise<T> {
  const max = opts?.max ?? COUNT_INFLIGHT_MAX;
  const waitMs = opts?.waitMs ?? COUNT_SLOT_WAIT_MS;
  const pollMs = opts?.pollMs ?? 150;
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (await tryAcquireCountSlot(max)) {
      try {
        return await fn();
      } finally {
        await releaseCountSlot();
      }
    }
    await sleep(pollMs);
  }
  return fn();
}

export async function tryAcquireCountLock(
  key: string,
  ttlSec = COUNT_LOCK_TTL_SEC,
): Promise<boolean> {
  const lockKey = `count:lock:${key}`;
  const ok = await upstashCommand<string>(["SET", lockKey, "1", "NX", "EX", ttlSec]);
  if (ok === "OK") return true;
  if (ok != null) return false;

  const now = Date.now();
  const locks = locksMem();
  const existing = locks.get(lockKey);
  if (existing && existing.expiresAt > now) return false;
  locks.set(lockKey, { expiresAt: now + ttlSec * 1000 });
  return true;
}

export async function releaseCountLock(key: string): Promise<void> {
  const lockKey = `count:lock:${key}`;
  await upstashCommand(["DEL", lockKey]);
  locksMem().delete(lockKey);
}

export async function withCountSingleFlight<T>(
  cacheKey: string,
  fn: () => Promise<T>,
  waitForLeader: () => Promise<T | null>,
  opts?: { waitMs?: number; pollMs?: number },
): Promise<T> {
  if (await tryAcquireCountLock(cacheKey)) {
    try {
      return await fn();
    } finally {
      await releaseCountLock(cacheKey);
    }
  }

  const waitMs = opts?.waitMs ?? 15_000;
  const pollMs = opts?.pollMs ?? 150;
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const hit = await waitForLeader();
    if (hit) return hit;
    await sleep(pollMs);
  }
  return fn();
}

export function resetCountSlotsForTests(): void {
  globalForSlots.__gridCountInflight = undefined;
  globalForSlots.__gridCountLocks = new Map();
}
