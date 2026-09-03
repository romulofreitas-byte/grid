import { describe, expect, it } from "vitest";
import { BACK } from "@/lib/back";
import {
  billingOrigin,
  billingReturn,
  billingSuccessReturn,
  pagarHref,
  pagarPendenteHref,
  pagarSucessoHref,
  pathWithSearch,
  planosHref,
  withFrom,
} from "./href";

describe("pathWithSearch", () => {
  it("joins pathname and query", () => {
    expect(pathWithSearch("/lead/1", "")).toBe("/lead/1");
    expect(pathWithSearch("/lead/1", "searchId=abc&from=listas")).toBe(
      "/lead/1?searchId=abc&from=listas",
    );
    expect(pathWithSearch("/crm", "?pipeline=p1")).toBe("/crm?pipeline=p1");
  });
});

describe("planosHref", () => {
  it("keeps bare planos without origin", () => {
    expect(planosHref()).toBe("/planos");
    expect(planosHref(null, true)).toBe("/planos#recarga");
  });

  it("puts from in the query and hash last", () => {
    expect(planosHref("/box")).toBe("/planos?from=/box");
    expect(planosHref("/box", true)).toBe("/planos?from=/box#recarga");
    expect(planosHref("/lead/1?searchId=abc&from=listas")).toBe(
      "/planos?from=/lead/1%3FsearchId%3Dabc%26from%3Dlistas",
    );
  });

  it("ignores loops and open redirects", () => {
    expect(planosHref("/planos")).toBe("/planos");
    expect(planosHref("/pagar?sku=piloto")).toBe("/planos");
    expect(planosHref("/entrar?next=/box")).toBe("/planos");
    expect(planosHref("https://evil.example/phish")).toBe("/planos");
  });
});

describe("pagarHref", () => {
  it("keeps sku and appends from", () => {
    expect(pagarHref("piloto")).toBe("/pagar?sku=piloto");
    expect(pagarHref("pack_100", "/conta")).toBe(
      "/pagar?sku=pack_100&from=/conta",
    );
  });
});

describe("withFrom", () => {
  it("preserves existing query on the target", () => {
    expect(withFrom("/pagar/sucesso?order=abc", "/lead/1")).toBe(
      "/pagar/sucesso?order=abc&from=/lead/1",
    );
    expect(pagarSucessoHref("ord-1", "/box")).toBe(
      "/pagar/sucesso?order=ord-1&from=/box",
    );
    expect(pagarPendenteHref("ord-1", "/box")).toBe(
      "/pagar/pendente?order=ord-1&from=/box",
    );
  });
});

describe("billingReturn", () => {
  it("falls back to início without origin", () => {
    expect(billingReturn(null)).toEqual(BACK.inicio);
    expect(billingReturn("/")).toEqual(BACK.inicio);
    expect(billingReturn("/planos")).toEqual(BACK.inicio);
    expect(billingOrigin("javascript:alert(1)")).toBeNull();
  });

  it("labels known app pages", () => {
    expect(billingReturn("/box")).toEqual({
      href: "/box",
      label: "Voltar ao Início",
    });
    expect(billingReturn("/lead/123?searchId=s&from=listas")).toEqual({
      href: "/lead/123?searchId=s&from=listas",
      label: "Voltar à ficha",
    });
    expect(billingReturn("/grid/abc?from=box")).toEqual({
      href: "/grid/abc?from=box",
      label: "Voltar à lista",
    });
    expect(billingReturn("/conta")).toEqual({
      href: "/conta",
      label: "Voltar à conta",
    });
    expect(billingReturn("/crm?pipeline=p1")).toEqual({
      href: "/crm?pipeline=p1",
      label: "Voltar ao CRM",
    });
    expect(billingReturn("/duvidas")).toEqual({
      href: "/duvidas",
      label: "Voltar",
    });
  });
});

describe("billingSuccessReturn", () => {
  it("sends public origins to the Início", () => {
    expect(billingSuccessReturn(null)).toEqual({
      href: "/box",
      label: "Ir ao Início",
    });
    expect(billingSuccessReturn("/")).toEqual({
      href: "/box",
      label: "Ir ao Início",
    });
    expect(billingSuccessReturn("/duvidas")).toEqual({
      href: "/box",
      label: "Ir ao Início",
    });
    expect(billingSuccessReturn("/box")).toEqual({
      href: "/box",
      label: "Ir ao Início",
    });
  });

  it("returns to the logged-in page that opened billing", () => {
    expect(billingSuccessReturn("/lead/1?searchId=s")).toEqual({
      href: "/lead/1?searchId=s",
      label: "Voltar à ficha",
    });
  });
});
