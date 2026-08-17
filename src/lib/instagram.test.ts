import { describe, expect, it } from "vitest";
import { parseInstagramHandle } from "./instagram";

describe("parseInstagramHandle", () => {
  it("extracts the username from profile URLs", () => {
    expect(parseInstagramHandle("https://www.instagram.com/acme.br/")).toBe(
      "acme.br",
    );
    expect(parseInstagramHandle("https://instagram.com/acme_br")).toBe(
      "acme_br",
    );
    expect(
      parseInstagramHandle("https://www.instagram.com/acme.br?utm_source=site"),
    ).toBe("acme.br");
    expect(parseInstagramHandle("instagram.com/acme")).toBe("acme");
  });

  it("accepts @handle and bare username", () => {
    expect(parseInstagramHandle("@acme.br")).toBe("acme.br");
    expect(parseInstagramHandle("acme_br")).toBe("acme_br");
  });

  it("ignores post and other non-profile paths", () => {
    expect(parseInstagramHandle("https://www.instagram.com/p/AbCd123/")).toBe(
      null,
    );
    expect(parseInstagramHandle("https://www.instagram.com/reel/AbCd123/")).toBe(
      null,
    );
    expect(
      parseInstagramHandle("https://www.instagram.com/reels/AbCd123/"),
    ).toBe(null);
    expect(
      parseInstagramHandle("https://www.instagram.com/stories/acme/123"),
    ).toBe(null);
    expect(parseInstagramHandle("https://www.instagram.com/explore/tags/x")).toBe(
      null,
    );
  });

  it("returns null for empty or invalid values", () => {
    expect(parseInstagramHandle(null)).toBe(null);
    expect(parseInstagramHandle("")).toBe(null);
    expect(parseInstagramHandle("   ")).toBe(null);
    expect(parseInstagramHandle("https://facebook.com/acme")).toBe(null);
    expect(parseInstagramHandle("not a handle!")).toBe(null);
  });
});
