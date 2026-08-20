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
  if (runtime.railway) return kind === "search" ? 1 : 2;
  if (isSessionPoolerUrl(runtime.databaseUrl)) return kind === "search" ? 1 : 2;
  return kind === "search" ? 5 : 8;
}

export function isPoolExhaustedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /EMAXCONNSESSION|max clients reached/i.test(message);
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
  return {
    connectionString: local ? url : connectionStringForPool(url),
    max: resolvePoolMax(kind, runtime),
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: serverless ? 4_000 : 20_000,
    allowExitOnIdle: serverless,
    ssl: local ? undefined : { rejectUnauthorized: false },
    options: `-c statement_timeout=${statementTimeoutMs}`,
  };
}

/** Short queries: profile, billing, ficha. */
export function getPool(): Pool {
  if (!globalForPg.__gridPool) {
    globalForPg.__gridPool = new Pool(poolOpts(15_000, "short"));
  }
  return globalForPg.__gridPool;
}

/** Count / runSearch / autocomplete — longer timeout, fewer connections. */
export function getSearchPool(): Pool {
  if (!globalForPg.__gridSearchPool) {
    globalForPg.__gridSearchPool = new Pool(poolOpts(60_000, "search"));
  }
  return globalForPg.__gridSearchPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function querySearch<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getSearchPool().query<T>(text, params);
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
}
