import { describe, expect, it } from "vitest";
import {
  readWorkingSearchId,
  WORKING_SEARCH_COOKIE,
  workingSearchCookie,
} from "./working-search";

describe("working search cookie", () => {
  it("reads the cookie from a header", () => {
    expect(readWorkingSearchId("a=1; grid_working_search=abc-123; b=2")).toBe(
      "abc-123",
    );
    expect(readWorkingSearchId(null)).toBeNull();
  });

  it("sets and clears the cookie", () => {
    expect(workingSearchCookie("abc")).toContain(`${WORKING_SEARCH_COOKIE}=abc`);
    expect(workingSearchCookie(null)).toMatch(/Max-Age=0/);
  });
});
