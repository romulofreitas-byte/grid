import { describe, expect, it } from "vitest";
import { parseCallbackParams } from "./callback-params";

describe("parseCallbackParams", () => {
  it("reads token_hash with a valid type", () => {
    const params = new URLSearchParams(
      "token_hash=abc&type=signup&next=/entrar?go=1",
    );
    expect(parseCallbackParams(params)).toEqual({
      kind: "verify",
      tokenHash: "abc",
      type: "signup",
    });
  });

  it("reads recovery separately from signup", () => {
    const params = new URLSearchParams("token_hash=xyz&type=recovery");
    expect(parseCallbackParams(params)).toEqual({
      kind: "verify",
      tokenHash: "xyz",
      type: "recovery",
    });
  });

  it("reads OAuth code", () => {
    const params = new URLSearchParams("code=oauth-code");
    expect(parseCallbackParams(params)).toEqual({
      kind: "oauth",
      code: "oauth-code",
    });
  });

  it("treats missing credentials as missing — not a silent success", () => {
    expect(parseCallbackParams(new URLSearchParams())).toEqual({
      kind: "missing",
    });
    expect(
      parseCallbackParams(new URLSearchParams("token_hash=abc")),
    ).toEqual({ kind: "missing" });
    expect(
      parseCallbackParams(new URLSearchParams("type=signup")),
    ).toEqual({ kind: "missing" });
    expect(
      parseCallbackParams(new URLSearchParams("next=/entrar?go=1")),
    ).toEqual({ kind: "missing" });
  });
});
