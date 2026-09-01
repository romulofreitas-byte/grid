import { describe, expect, it } from "vitest";
import {
  isMissingOrUnpopulatedRelationError,
  isPoolExhaustedError,
  isPoolerUrl,
  isSessionPoolerUrl,
  isStatementTimeoutError,
  isUndefinedTableError,
  isUnpopulatedRelationError,
  pgErrorCode,
  preferTransactionPoolerUrl,
  resolvePoolMax,
  sharesPgPools,
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

  it("classifies session pooler exhaustion", () => {
    expect(
      isPoolExhaustedError(
        new Error(
          "(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15",
        ),
      ),
    ).toBe(true);
    expect(isPoolExhaustedError(new Error("connection terminated"))).toBe(false);
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
    ).toMatch(/pista está cheia/i);
    expect(userFacingDbBusyMessage(new Error("boom"))).toMatch(/instantes/i);
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
