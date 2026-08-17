import { Pool, type QueryResult, type QueryResultRow } from "pg";

export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";

const globalForPg = globalThis as typeof globalThis & { __gridPool?: Pool };

function isLocalDatabaseHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return true;
  }
}

export function getPool(): Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForPg.__gridPool) {
    const local = isLocalDatabaseHost(url);
    globalForPg.__gridPool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 20_000,
      ssl: local ? undefined : { rejectUnauthorized: false },
      options: "-c statement_timeout=30000",
    });
  }
  return globalForPg.__gridPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function endPool(): Promise<void> {
  if (!globalForPg.__gridPool) return;
  await globalForPg.__gridPool.end();
  globalForPg.__gridPool = undefined;
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
