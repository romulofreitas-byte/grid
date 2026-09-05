export const CRM_BOARD_CACHE_TTL_MS = 30_000;
export const CRM_HOVER_PREFETCH_MS = 280;

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

/** Hover-prefetch only the last id, one request at a time. */
export function createLatestPrefetch(opts: {
  delayMs?: number;
  isFresh: (id: string) => boolean;
  run: (id: string) => Promise<unknown>;
}): { hover: (id: string) => void; cancel: () => void } {
  const delayMs = opts.delayMs ?? CRM_HOVER_PREFETCH_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let busy = false;
  let queued: string | null = null;

  function kick(id: string) {
    if (opts.isFresh(id)) return;
    if (busy) {
      queued = id;
      return;
    }
    busy = true;
    void opts
      .run(id)
      .catch(() => undefined)
      .finally(() => {
        busy = false;
        const next = queued;
        queued = null;
        if (next && next !== id) kick(next);
      });
  }

  return {
    hover(id: string) {
      if (opts.isFresh(id)) return;
      queued = id;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const target = queued;
        queued = null;
        if (target) kick(target);
      }, delayMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      queued = null;
    },
  };
}
