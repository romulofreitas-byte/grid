import { describe, expect, it } from "vitest";
import {
  isMissingOrUnpopulatedRelationError,
  isPoolExhaustedError,
  isSessionPoolerUrl,
  isStatementTimeoutError,
  isUndefinedTableError,
  isUnpopulatedRelationError,
  pgErrorCode,
  resolvePoolMax,
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

  it("caps session pooler so app + worker fit in 15 clients", () => {
    const url =
      "postgresql://postgres.abc:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";
    expect(resolvePoolMax("short", { databaseUrl: url })).toBe(2);
    expect(resolvePoolMax("search", { databaseUrl: url })).toBe(1);
    expect(resolvePoolMax("short", { databaseUrl: url, railway: true })).toBe(2);
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
});
