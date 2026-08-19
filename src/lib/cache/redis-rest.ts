/** Minimal Upstash Redis REST client (shared by count cache + rate limits). */

export async function upstashCommand<T>(command: unknown[]): Promise<T | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(command),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: T };
    return body.result ?? null;
  } catch {
    return null;
  }
}

export async function upstashPipeline(
  commands: unknown[][],
): Promise<unknown[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(commands),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown[] };
    return Array.isArray(body.result) ? body.result : null;
  } catch {
    return null;
  }
}

/** Fixed-window counter — returns null when Redis unavailable. */
export async function redisTakeToken(
  key: string,
  limit: number,
  windowSec: number,
  now = Date.now(),
): Promise<{ ok: boolean; remaining: number; resetAt: number } | null> {
  const pipeline = await upstashPipeline([
    ["INCR", key],
    ["TTL", key],
  ]);
  if (!pipeline) return null;

  const count = Number(pipeline[0] ?? 0);
  let ttlSec = Number(pipeline[1] ?? -1);
  if (count === 1) {
    await upstashCommand(["EXPIRE", key, windowSec]);
    ttlSec = windowSec;
  }
  const resetAt = now + (ttlSec > 0 ? ttlSec : windowSec) * 1000;
  if (count > limit) {
    return { ok: false, remaining: 0, resetAt };
  }
  return { ok: true, remaining: limit - count, resetAt };
}
