import { createHash } from "node:crypto";
import { upstashCommand } from "@/lib/cache/redis-rest";
import type { CountMode, CountResult, SearchFilters } from "@/lib/types";

const COUNT_CACHE_TTL_SEC = 600; // 10 min
const MEM_TTL_MS = COUNT_CACHE_TTL_SEC * 1000;

type MemEntry = { value: CountResult; expiresAt: number };

const globalForCountCache = globalThis as typeof globalThis & {
  __gridCountCache?: Map<string, MemEntry>;
};

function memCache(): Map<string, MemEntry> {
  if (!globalForCountCache.__gridCountCache) {
    globalForCountCache.__gridCountCache = new Map();
  }
  return globalForCountCache.__gridCountCache;
}

function stableAllowed(allowed: Set<string> | null): string[] | null {
  if (!allowed) return null;
  return [...allowed].sort();
}

export function countCacheKey(
  filters: SearchFilters,
  mode: CountMode,
  allowed: Set<string> | null,
): string {
  const payload = JSON.stringify({ filters, mode, allowed: stableAllowed(allowed) });
  const hash = createHash("sha256").update(payload).digest("hex");
  return `count:v2:${hash}`;
}

/** CNPJs a full Qualidade count already scanned — skip ranked SQL in runSearch. */
export function cachedCandidateCnpjs(
  result: CountResult | null | undefined,
  cap: number,
): string[] | null {
  if (!result || result.capped) return null;
  const list = result.cnpjs;
  if (!list?.length || result.total > cap || list.length > cap) return null;
  if (list.length !== result.total) return null;
  return list;
}

export function countResultForClient(result: CountResult): CountResult {
  if (!result.cnpjs) return result;
  const { cnpjs: _cnpjs, ...rest } = result;
  return rest;
}

export async function getCountCache(key: string): Promise<CountResult | null> {
  const raw = await upstashCommand<string>(["GET", key]);
  if (raw) {
    try {
      return JSON.parse(raw) as CountResult;
    } catch {
      /* fall through to memory */
    }
  }

  const entry = memCache().get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) memCache().delete(key);
    return null;
  }
  return entry.value;
}

export async function setCountCache(key: string, value: CountResult): Promise<void> {
  const serialized = JSON.stringify(value);
  const ok = await upstashCommand<string>([
    "SET",
    key,
    serialized,
    "EX",
    COUNT_CACHE_TTL_SEC,
  ]);
  if (ok === "OK") return;
  memCache().set(key, { value, expiresAt: Date.now() + MEM_TTL_MS });
}
