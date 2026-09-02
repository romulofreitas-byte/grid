import { Pool, type QueryResult, type QueryResultRow } from "pg";

export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";

const globalForPg = globalThis as typeof globalThis & {
  __gridPool?: Pool;
  __gridSearchPool?: Pool;
};

function isLocalDatabaseHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|127\.0\.0\.1/.test(url);
  }
}

/** pg 8.16+ treats URL sslmode=require as verify-full and ignores Pool.ssl. */
function connectionStringForPool(url: string): string {
  const stripped = url
    .replace(/[?&]sslmode=[^&]*/gi, "")
    .replace(/[?&]sslrootcert=[^&]*/gi, "")
    .replace(/\?&/, "?")
    .replace(/&&+/g, "&")
    .replace(/\?$/, "")
    .replace(/&$/, "");
  try {
    const parsed = new URL(stripped);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("sslrootcert");
    parsed.searchParams.set("uselibpqcompat", "true");
    return parsed.toString();
  } catch {
    const joiner = stripped.includes("?") ? "&" : "?";
    return `${stripped}${joiner}uselibpqcompat=true`;
  }
}

export type PgPoolKind = "short" | "search";

export type PgPoolRuntime = {
  databaseUrl: string;
  overrideMax?: number;
  vercel?: boolean;
  railway?: boolean;
};

/** Supabase session pooler is :5432 on *.pooler.supabase.com (cap often 15). */
export function isSessionPoolerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pooler = parsed.hostname.includes("pooler");
    const port = parsed.port || "5432";
    return pooler && port === "5432";
  } catch {
    return /pooler/i.test(url) && !/:6543\b/.test(url);
  }
}

export function isPoolerUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes("pooler");
  } catch {
    return /pooler/i.test(url);
  }
}

/**
 * Session-mode Supavisor caps at ~15 clients (EMAXCONNSESSION).
 * Transaction mode (6543) multiplexes the app, worker, and local dev.
 * SET LOCAL inside BEGIN/COMMIT still works. PG_SESSION_POOLER=1 keeps 5432.
 */
export function preferTransactionPoolerUrl(
  url: string,
  opts?: { keepSession?: boolean },
): string {
  if (opts?.keepSession || !isSessionPoolerUrl(url)) return url;
  try {
    const parsed = new URL(url);
    parsed.port = "6543";
    parsed.searchParams.set("pgbouncer", "true");
    return parsed.toString();
  } catch {
    const withPort = url.replace(/:5432(?=\/|\?|$)/, ":6543");
    if (/[?&]pgbouncer=/i.test(withPort)) return withPort;
    return withPort.includes("?")
      ? `${withPort}&pgbouncer=true`
      : `${withPort}?pgbouncer=true`;
  }
}

/**
 * Session-mode Supavisor rejects extra clients with EMAXCONNSESSION (pool_size 15).
 * Vercel isolates each multiply max, so serverless stays at 1 per pool.
 */
export function resolvePoolMax(kind: PgPoolKind, runtime: PgPoolRuntime): number {
  const override = runtime.overrideMax;
  if (override != null && Number.isFinite(override) && override >= 1) {
    return Math.min(8, Math.floor(override));
  }
  if (runtime.vercel) return 1;
  if (isSessionPoolerUrl(runtime.databaseUrl)) return 1;
  if (runtime.railway) return kind === "search" ? 1 : 2;
  if (isPoolerUrl(runtime.databaseUrl)) return kind === "search" ? 1 : 2;
  return kind === "search" ? 5 : 8;
}

export function isPoolExhaustedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /EMAXCONNSESSION|max clients reached/i.test(message);
}

export function isPgConnectTimeoutError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /timeout exceeded when trying to connect/i.test(message);
}

/** Vercel pool max is 1 — starting queries together waits on a client and times out. */
export function shouldSerializePgQueries(): boolean {
  return Boolean(process.env.VERCEL);
}

export async function allQueries<T extends unknown[]>(
  factories: { [K in keyof T]: () => Promise<T[K]> },
): Promise<T> {
  if (!shouldSerializePgQueries()) {
    return Promise.all(factories.map((factory) => factory())) as Promise<T>;
  }
  const result: unknown[] = [];
  for (const factory of factories) {
    result.push(await factory());
  }
  return result as T;
}

export function searchJobFailureMessage(err: unknown): string {
  if (isPoolExhaustedError(err) || isPgConnectTimeoutError(err)) {
    return userFacingDbBusyMessage(err);
  }
  if (isStatementTimeoutError(err)) {
    return "A busca demorou demais. Tente de novo com um recorte menor.";
  }
  return "Não foi possível montar o grid. Tente de novo em instantes.";
}

export function userFacingDbBusyMessage(err: unknown): string {
  return isPoolExhaustedError(err)
    ? "A pista está cheia agora. Tenta de novo em instantes."
    : "Tente de novo em instantes.";
}

/** Vercel isolates multiply connections; session pooler must not open two pools. */
export function sharesPgPools(
  runtime: Pick<PgPoolRuntime, "vercel" | "databaseUrl">,
): boolean {
  return Boolean(runtime.vercel) || isSessionPoolerUrl(runtime.databaseUrl ?? "");
}

export async function withPgRetry<T>(
  fn: () => Promise<T>,
  opts?: { attempts?: number; delayMs?: (attempt: number) => number },
): Promise<T> {
  const attempts = opts?.attempts ?? 6;
  const delayMs = opts?.delayMs ?? ((attempt) => 200 * 2 ** attempt);
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isPoolExhaustedError(err) || attempt === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs(attempt)));
    }
  }
  throw last;
}

function currentPoolRuntime(): PgPoolRuntime {
  const raw = Number(process.env.PG_POOL_MAX);
  return {
    databaseUrl: process.env.DATABASE_URL?.trim() ?? "",
    overrideMax: Number.isFinite(raw) && raw >= 1 ? raw : undefined,
    vercel: Boolean(process.env.VERCEL),
    railway: Boolean(
      process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_ID,
    ),
  };
}

function poolOpts(statementTimeoutMs: number, kind: PgPoolKind) {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = isLocalDatabaseHost(url);
  const runtime = currentPoolRuntime();
  const serverless = Boolean(runtime.vercel);
  const keepSession = process.env.PG_SESSION_POOLER === "1";
  const resolved = local ? url : preferTransactionPoolerUrl(url, { keepSession });
  const pooler = isPoolerUrl(resolved) || isSessionPoolerUrl(url);
  const usingTxPooler = resolved !== url || /:6543\b/.test(resolved);
  return {
    connectionString: local ? url : connectionStringForPool(resolved),
    max: resolvePoolMax(kind, runtime),
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: serverless || pooler ? 4_000 : 20_000,
    allowExitOnIdle: serverless || pooler,
    ssl: local ? undefined : { rejectUnauthorized: false },
    // Startup -c options are stripped/rejected by transaction-mode poolers.
    options: usingTxPooler
      ? undefined
      : `-c statement_timeout=${statementTimeoutMs}`,
  };
}

/** Short queries: profile, billing, ficha. */
export function getPool(): Pool {
  if (!globalForPg.__gridPool) {
    const runtime = currentPoolRuntime();
    const timeout = sharesPgPools(runtime) ? 60_000 : 15_000;
    globalForPg.__gridPool = new Pool(poolOpts(timeout, "short"));
  }
  return globalForPg.__gridPool;
}

/** Count / runSearch / autocomplete — longer timeout, fewer connections. */
export function getSearchPool(): Pool {
  if (sharesPgPools(currentPoolRuntime())) return getPool();
  if (!globalForPg.__gridSearchPool) {
    globalForPg.__gridSearchPool = new Pool(poolOpts(60_000, "search"));
  }
  return globalForPg.__gridSearchPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return withPgRetry(() => getPool().query<T>(text, params));
}

export async function querySearch<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return withPgRetry(() => getSearchPool().query<T>(text, params));
}

/**
 * Run a search query inside a transaction so SET LOCAL statement_timeout
 * can cap one autocomplete without changing the pool's 60s default.
 */
export async function querySearchWithTimeout<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  timeoutMs = 4_000,
): Promise<QueryResult<T>> {
  const ms = Math.max(500, Math.min(15_000, Math.floor(timeoutMs)));
  return withPgRetry(async () => {
    const client = await getSearchPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL statement_timeout = ${ms}`);
      const result = await client.query<T>(text, params);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  });
}

export async function endPool(): Promise<void> {
  if (globalForPg.__gridPool) {
    await globalForPg.__gridPool.end();
    globalForPg.__gridPool = undefined;
  }
  if (globalForPg.__gridSearchPool) {
    await globalForPg.__gridSearchPool.end();
    globalForPg.__gridSearchPool = undefined;
  }
}

export function pgErrorCode(err: unknown): string {
  if (!err || typeof err !== "object" || !("code" in err)) return "";
  return String((err as { code?: unknown }).code ?? "");
}

/** Postgres 42703 — column missing (migration not applied). */
export function isUndefinedColumnError(err: unknown): boolean {
  return pgErrorCode(err) === "42703";
}

/** Postgres 42P01 — table missing (migrations not applied). */
export function isUndefinedTableError(err: unknown): boolean {
  return pgErrorCode(err) === "42P01";
}

/** Postgres 55000 — materialized view created WITH NO DATA and never refreshed. */
export function isUnpopulatedRelationError(err: unknown): boolean {
  return pgErrorCode(err) === "55000";
}

export function isMissingOrUnpopulatedRelationError(err: unknown): boolean {
  return isUndefinedTableError(err) || isUnpopulatedRelationError(err);
}

/** Postgres 57014 — statement_timeout / query canceled. */
export function isStatementTimeoutError(err: unknown): boolean {
  return pgErrorCode(err) === "57014";
}

export type SqlQuery = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) => Promise<QueryResult<T>>;

export async function withTransaction<T>(fn: (q: SqlQuery) => Promise<T>): Promise<T> {
  return withPgRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await fn((text, params) => client.query(text, params));
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  });
}
