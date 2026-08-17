import { describe, expect, it } from "vitest";
import { parseEmailOtpType } from "./otp";

describe("parseEmailOtpType", () => {
  it("accepts auth email types", () => {
    expect(parseEmailOtpType("email")).toBe("email");
    expect(parseEmailOtpType("magiclink")).toBe("magiclink");
    expect(parseEmailOtpType("signup")).toBe("signup");
    expect(parseEmailOtpType("recovery")).toBe("recovery");
  });

  it("rejects unknown values", () => {
    expect(parseEmailOtpType(null)).toBeNull();
    expect(parseEmailOtpType("sms")).toBeNull();
    expect(parseEmailOtpType("password")).toBeNull();
  });
});
