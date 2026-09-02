import { describe, expect, it } from "vitest";
import {
  companySiteHref,
  companySiteLabel,
  homeFetchCandidates,
  homepagePathFromUrl,
  normalizeHomepagePath,
  parseCompanySite,
} from "./company-site";

describe("parseCompanySite", () => {
  it("keeps a shallow /home/ path and strips www", () => {
    expect(parseCompanySite("https://www.produtosmarina.com.br/home/")).toEqual({
      host: "produtosmarina.com.br",
      homepagePath: "/home",
    });
  });

  it("ignores deep article paths", () => {
    expect(parseCompanySite("https://www.novo-site.com.br/contato")).toEqual({
      host: "novo-site.com.br",
      homepagePath: null,
    });
    expect(parseCompanySite("exemplo.com.br/blog/post-1")).toEqual({
      host: "exemplo.com.br",
      homepagePath: null,
    });
  });

  it("returns null for directories and junk", () => {
    expect(parseCompanySite("")).toBeNull();
    expect(parseCompanySite("localhost")).toBeNull();
  });
});

describe("homepage paths", () => {
  it("normalizes trailing slashes and URL pathnames", () => {
    expect(normalizeHomepagePath("/home/")).toBe("/home");
    expect(normalizeHomepagePath("/inicio")).toBe("/inicio");
    expect(normalizeHomepagePath("/loja/")).toBe("/loja");
    expect(normalizeHomepagePath("/")).toBeNull();
    expect(homepagePathFromUrl("https://loja.test/home/")).toBe("/home");
  });

  it("fetches only the known storefront — never guesses /home", () => {
    expect(homeFetchCandidates("/home")).toEqual(["/home"]);
    expect(homeFetchCandidates(null)).toEqual(["/"]);
    expect(homeFetchCandidates("/")).toEqual(["/"]);
  });

  it("builds href and label with the storefront path", () => {
    expect(companySiteHref("produtosmarina.com.br", "/home")).toBe(
      "https://produtosmarina.com.br/home",
    );
    expect(companySiteLabel("produtosmarina.com.br", "/home/")).toBe(
      "produtosmarina.com.br/home",
    );
    expect(companySiteHref("exemplo.com.br", null)).toBe("https://exemplo.com.br");
  });
});
