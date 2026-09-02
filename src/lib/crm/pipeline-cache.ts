export const CRM_BOARD_CACHE_TTL_MS = 30_000;

export function isBoardCacheFresh(
  fetchedAt: number | undefined,
  now = Date.now(),
  ttlMs = CRM_BOARD_CACHE_TTL_MS,
): boolean {
  if (fetchedAt == null) return false;
  return now - fetchedAt < ttlMs;
}

export function dedupeInflight<T>(
  inflight: Map<string, Promise<T>>,
  key: string,
  start: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = start().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}
