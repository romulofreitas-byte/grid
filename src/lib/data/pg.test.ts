import { describe, expect, it } from "vitest";
import {
  isMissingOrUnpopulatedRelationError,
  isStatementTimeoutError,
  isUndefinedTableError,
  isUnpopulatedRelationError,
  pgErrorCode,
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
});
