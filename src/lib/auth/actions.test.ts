import { describe, expect, it } from "vitest";
import { parseAuthAction } from "./actions";

describe("parseAuthAction", () => {
  it("accepts login signup recover password", () => {
    expect(parseAuthAction({ action: "login" })).toBe("login");
    expect(parseAuthAction({ action: "signup" })).toBe("signup");
    expect(parseAuthAction({ action: "recover" })).toBe("recover");
    expect(parseAuthAction({ action: "password" })).toBe("password");
  });

  it("maps google provider or action", () => {
    expect(parseAuthAction({ provider: "google" })).toBe("google");
    expect(parseAuthAction({ action: "google" })).toBe("google");
  });

  it("rejects missing or unknown actions", () => {
    expect(parseAuthAction({})).toBeNull();
    expect(parseAuthAction({ action: "magic" })).toBeNull();
    expect(parseAuthAction({ action: "otp" })).toBeNull();
  });
});
