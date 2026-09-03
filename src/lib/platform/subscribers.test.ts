import { describe, expect, it } from "vitest";
import {
  normalizeSubscriberEmail,
  shouldShowPlatformCouponBanner,
} from "./subscribers";

describe("normalizeSubscriberEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeSubscriberEmail("  Piloto@MundoPodium.com.br  ")).toBe(
      "piloto@mundopodium.com.br",
    );
  });

  it("rejects invalid", () => {
    expect(normalizeSubscriberEmail("")).toBeNull();
    expect(normalizeSubscriberEmail("not-an-email")).toBeNull();
  });
});

describe("shouldShowPlatformCouponBanner", () => {
  it("shows for subscribers who are not already on membro_plataforma", () => {
    expect(shouldShowPlatformCouponBanner(true, "free")).toBe(true);
    expect(shouldShowPlatformCouponBanner(true, "piloto")).toBe(true);
    expect(shouldShowPlatformCouponBanner(true, "membro_plataforma")).toBe(false);
  });

  it("hides for non-subscribers", () => {
    expect(shouldShowPlatformCouponBanner(false, "free")).toBe(false);
  });
});
