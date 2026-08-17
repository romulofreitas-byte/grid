import { describe, expect, it } from "vitest";
import { supportWhatsAppDigits, supportWhatsAppHref } from "./support";

describe("supportWhatsAppDigits", () => {
  it("accepts E.164 without plus", () => {
    expect(supportWhatsAppDigits("5531953491412")).toBe("5531953491412");
  });

  it("accepts +55 and punctuation", () => {
    expect(supportWhatsAppDigits("+55 31 95349-1412")).toBe("5531953491412");
  });

  it("prefixes 55 on local mobile", () => {
    expect(supportWhatsAppDigits("31953491412")).toBe("5531953491412");
  });

  it("returns null when empty or invalid", () => {
    expect(supportWhatsAppDigits("")).toBeNull();
    expect(supportWhatsAppDigits("123")).toBeNull();
    expect(supportWhatsAppDigits(null)).toBeNull();
  });
});

describe("supportWhatsAppHref", () => {
  it("builds wa.me with name and screen", () => {
    const href = supportWhatsAppHref({
      phone: "5531953491412",
      name: "Rômulo",
      pathname: "/box",
    });
    expect(href).toBe(
      `https://wa.me/5531953491412?text=${encodeURIComponent(
        "Olá, sou Rômulo e estou no GRID (/box). Preciso de ajuda.",
      )}`,
    );
  });

  it("falls back to Piloto and /", () => {
    const href = supportWhatsAppHref({ phone: "31953491412" });
    expect(href).toContain("sou%20Piloto");
    expect(href).toContain("(%2F)");
  });

  it("returns null without a number", () => {
    expect(supportWhatsAppHref({ phone: "" })).toBeNull();
  });
});
