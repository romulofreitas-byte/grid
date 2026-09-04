import { describe, expect, it } from "vitest";
import { googleOAuthQueryParams } from "./google-provider";

describe("googleOAuthQueryParams", () => {
  it("asks Google for an account picker without forcing consent", () => {
    const params = googleOAuthQueryParams();
    expect(params.prompt).toBe("select_account");
    expect(JSON.stringify(params)).not.toMatch(/consent/);
    expect(JSON.stringify(params)).not.toMatch(/offline/);
  });
});
