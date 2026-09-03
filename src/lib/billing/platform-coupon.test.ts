import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PLATFORM_COUPON,
  expectedPlatformCoupon,
  isValidPlatformCoupon,
  normalizePlatformCoupon,
} from "./platform-coupon";

const previous = process.env.BILLING_PLATFORM_COUPON;

afterEach(() => {
  if (previous === undefined) delete process.env.BILLING_PLATFORM_COUPON;
  else process.env.BILLING_PLATFORM_COUPON = previous;
});

describe("normalizePlatformCoupon", () => {
  it("uppercases, strips spaces and maps legacy codes to PILOTO", () => {
    expect(normalizePlatformCoupon("  piloto  ")).toBe(DEFAULT_PLATFORM_COUPON);
    expect(normalizePlatformCoupon("Piloto")).toBe(DEFAULT_PLATFORM_COUPON);
    expect(normalizePlatformCoupon("  piloto podium  ")).toBe(DEFAULT_PLATFORM_COUPON);
    expect(normalizePlatformCoupon("PilotoPódium")).toBe(DEFAULT_PLATFORM_COUPON);
    expect(normalizePlatformCoupon("PODIUM")).toBe(DEFAULT_PLATFORM_COUPON);
    expect(normalizePlatformCoupon('"PILOTOPODIUM"')).toBe(DEFAULT_PLATFORM_COUPON);
  });
});

describe("expectedPlatformCoupon", () => {
  it("defaults to PILOTO when the env is empty", () => {
    delete process.env.BILLING_PLATFORM_COUPON;
    expect(expectedPlatformCoupon()).toBe(DEFAULT_PLATFORM_COUPON);
  });

  it("treats leftover PODIUM and PILOTOPODIUM env as PILOTO", () => {
    process.env.BILLING_PLATFORM_COUPON = "PODIUM";
    expect(expectedPlatformCoupon()).toBe(DEFAULT_PLATFORM_COUPON);
    process.env.BILLING_PLATFORM_COUPON = "PILOTOPODIUM";
    expect(expectedPlatformCoupon()).toBe(DEFAULT_PLATFORM_COUPON);
  });

  it("honors a rotated env coupon", () => {
    process.env.BILLING_PLATFORM_COUPON = "NOVOCUPOM";
    expect(expectedPlatformCoupon()).toBe("NOVOCUPOM");
  });
});

describe("isValidPlatformCoupon", () => {
  it("accepts the published coupon even when env still has PODIUM", () => {
    process.env.BILLING_PLATFORM_COUPON = "PODIUM";
    expect(isValidPlatformCoupon("PILOTO")).toBe(true);
    expect(isValidPlatformCoupon("piloto")).toBe(true);
    expect(isValidPlatformCoupon("PILOTOPODIUM")).toBe(true);
    expect(isValidPlatformCoupon("errado")).toBe(false);
  });

  it("accepts PILOTO when env is unset", () => {
    delete process.env.BILLING_PLATFORM_COUPON;
    expect(isValidPlatformCoupon("PILOTO")).toBe(true);
  });
});
