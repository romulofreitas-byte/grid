import { describe, expect, it } from "vitest";
import {
  allQueries,
  isMissingOrUnpopulatedRelationError,
  isPgConnectTimeoutError,
  isPoolExhaustedError,
  isPoolerUrl,
  isSessionPoolerUrl,
  isStatementTimeoutError,
  isUndefinedColumnError,
  isUndefinedTableError,
  isUnpopulatedRelationError,
  pgErrorCode,
  preferTransactionPoolerUrl,
  resolvePoolMax,
  sharesPgPools,
  searchJobFailureMessage,
  shouldSerializePgQueries,
  userFacingDbBusyMessage,
  withPgRetry,
} from "./pg";

function pgErr(code: string): Error & { code: string } {
  const err = new Error(code) as Error & { code: string };
  err.code = code;
  return err;
}

describe("pg error helpers", () => {
  it("reads SQLSTATE from pg errors", () => {
    expect(pgErrorCode(pgErr("42P01"))).toBe("42P01");
    expect(pgErrorCode(new Error("nope"))).toBe("");
    expect(pgErrorCode("x")).toBe("");
  });

  it("classifies missing and unpopulated relations", () => {
    expect(isUndefinedTableError(pgErr("42P01"))).toBe(true);
    expect(isUnpopulatedRelationError(pgErr("55000"))).toBe(true);
    expect(isMissingOrUnpopulatedRelationError(pgErr("42P01"))).toBe(true);
    expect(isMissingOrUnpopulatedRelationError(pgErr("55000"))).toBe(true);
    expect(isMissingOrUnpopulatedRelationError(pgErr("57014"))).toBe(false);
  });

  it("classifies statement timeout", () => {
    expect(isStatementTimeoutError(pgErr("57014"))).toBe(true);
    expect(isStatementTimeoutError(pgErr("42P01"))).toBe(false);
  });

  it("classifies missing columns", () => {
    expect(isUndefinedColumnError(pgErr("42703"))).toBe(true);
    expect(isUndefinedColumnError(pgErr("42P01"))).toBe(false);
  });

  it("classifies session pooler exhaustion", () => {
    expect(
      isPoolExhaustedError(
        new Error(
          "(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15",
        ),
      ),
    ).toBe(true);
    expect(isPoolExhaustedError(new Error("connection terminated"))).toBe(false);
    expect(
      isPgConnectTimeoutError(
        new Error("timeout exceeded when trying to connect"),
      ),
    ).toBe(true);
    expect(isPgConnectTimeoutError(new Error("syntax error"))).toBe(false);
  });
});

describe("resolvePoolMax", () => {
  it("detects Supabase session pooler URLs", () => {
    expect(
      isSessionPoolerUrl(
        "postgresql://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres",
      ),
    ).toBe(true);
    expect(
      isSessionPoolerUrl(
        "postgresql://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
      ),
    ).toBe(false);
    expect(isSessionPoolerUrl("postgresql://grid:grid@127.0.0.1:5432/grid")).toBe(
      false,
    );
  });

  it("keeps one connection per pool on Vercel", () => {
    expect(
      resolvePoolMax("short", { databaseUrl: "", vercel: true }),
    ).toBe(1);
    expect(
      resolvePoolMax("search", { databaseUrl: "", vercel: true }),
    ).toBe(1);
  });

  it("rewrites session pooler URLs to transaction mode", () => {
    const session =
      "postgresql://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";
    const rewritten = preferTransactionPoolerUrl(session);
    expect(rewritten).toContain(":6543/");
    expect(rewritten).toContain("pgbouncer=true");
    expect(preferTransactionPoolerUrl(session, { keepSession: true })).toBe(
      session,
    );
    expect(isPoolerUrl(session)).toBe(true);
    expect(
      isPoolerUrl("postgresql://postgres.abc:x@db.abc.supabase.co:5432/postgres"),
    ).toBe(false);
  });

  it("caps session pooler to one client so Vercel + worker + local fit", () => {
    const url =
      "postgresql://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";
    expect(resolvePoolMax("short", { databaseUrl: url })).toBe(1);
    expect(resolvePoolMax("search", { databaseUrl: url })).toBe(1);
    expect(resolvePoolMax("short", { databaseUrl: url, railway: true })).toBe(1);
  });

  it("keeps larger local pools on direct Postgres", () => {
    expect(
      resolvePoolMax("short", {
        databaseUrl: "postgresql://grid:grid@127.0.0.1:5432/grid",
      }),
    ).toBe(8);
    expect(
      resolvePoolMax("search", {
        databaseUrl: "postgresql://grid:grid@127.0.0.1:5432/grid",
      }),
    ).toBe(5);
  });

  it("shares one pool on Vercel or session pooler", () => {
    expect(sharesPgPools({ vercel: true })).toBe(true);
    expect(sharesPgPools({ vercel: false })).toBe(false);
    expect(
      sharesPgPools({
        vercel: false,
        databaseUrl:
          "postgresql://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres",
      }),
    ).toBe(true);
  });

  it("hides pooler internals from the piloto", () => {
    expect(
      userFacingDbBusyMessage(
        new Error(
          "(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15",
        ),
      ),
    ).toMatch(/sistema está ocupado/i);
    expect(userFacingDbBusyMessage(new Error("boom"))).toMatch(/instantes/i);
  });

  it("hides search job pool and timeout internals", () => {
    expect(
      searchJobFailureMessage(
        new Error(
          "(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15",
        ),
      ),
    ).toMatch(/sistema está ocupado/i);
    expect(
      searchJobFailureMessage(
        new Error("timeout exceeded when trying to connect"),
      ),
    ).toMatch(/instantes/i);
    const timeout = Object.assign(new Error("canceling statement"), {
      code: "57014",
    });
    expect(searchJobFailureMessage(timeout)).toMatch(/recorte menor/i);
    expect(searchJobFailureMessage(new Error("relation boom"))).toMatch(
      /montar o grid/i,
    );
  });
});

describe("withPgRetry", () => {
  it("retries EMAXCONNSESSION then succeeds", async () => {
    let n = 0;
    const value = await withPgRetry(
      async () => {
        n += 1;
        if (n < 3) {
          throw new Error(
            "(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15",
          );
        }
        return "ok";
      },
      { delayMs: () => 0 },
    );
    expect(value).toBe("ok");
    expect(n).toBe(3);
  });

  it("does not retry unrelated errors", async () => {
    let n = 0;
    await expect(
      withPgRetry(
        async () => {
          n += 1;
          throw new Error("syntax error");
        },
        { delayMs: () => 0 },
      ),
    ).rejects.toThrow("syntax error");
    expect(n).toBe(1);
  });
});

describe("allQueries", () => {
  it("runs factories together off Vercel", async () => {
    const prev = process.env.VERCEL;
    delete process.env.VERCEL;
    try {
      expect(shouldSerializePgQueries()).toBe(false);
      let concurrent = 0;
      let maxConcurrent = 0;
      await allQueries([
        async () => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 30));
          concurrent -= 1;
          return "a";
        },
        async () => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 30));
          concurrent -= 1;
          return "b";
        },
      ]);
      expect(maxConcurrent).toBe(2);
    } finally {
      if (prev == null) delete process.env.VERCEL;
      else process.env.VERCEL = prev;
    }
  });

  it("runs factories one at a time on Vercel", async () => {
    const prev = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
      expect(shouldSerializePgQueries()).toBe(true);
      let concurrent = 0;
      let maxConcurrent = 0;
      const [first, second] = await allQueries([
        async () => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 30));
          concurrent -= 1;
          return "a";
        },
        async () => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 30));
          concurrent -= 1;
          return "b";
        },
      ]);
      expect(first).toBe("a");
      expect(second).toBe("b");
      expect(maxConcurrent).toBe(1);
    } finally {
      if (prev == null) delete process.env.VERCEL;
      else process.env.VERCEL = prev;
    }
  });
});
