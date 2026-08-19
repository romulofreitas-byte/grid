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
    return true;
  }
}

/** pg 8.16+ treats URL sslmode=require as verify-full and ignores Pool.ssl. */
function connectionStringForPool(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("sslrootcert");
    parsed.searchParams.set("uselibpqcompat", "true");
    return parsed.toString();
  } catch {
    return url;
  }
}

function poolOpts(statementTimeoutMs: number, max: number) {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = isLocalDatabaseHost(url);
  return {
    connectionString: local ? url : connectionStringForPool(url),
    max,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 20_000,
    ssl: local ? undefined : { rejectUnauthorized: false },
    options: `-c statement_timeout=${statementTimeoutMs}`,
  };
}

/** Short queries: profile, billing, ficha. */
export function getPool(): Pool {
  if (!globalForPg.__gridPool) {
    globalForPg.__gridPool = new Pool(poolOpts(15_000, 8));
  }
  return globalForPg.__gridPool;
}

/** Count / runSearch / autocomplete — longer timeout, fewer connections. */
export function getSearchPool(): Pool {
  if (!globalForPg.__gridSearchPool) {
    globalForPg.__gridSearchPool = new Pool(poolOpts(60_000, 5));
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
