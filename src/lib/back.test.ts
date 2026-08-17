import { describe, expect, it } from "vitest";
import {
  BACK,
  gridBack,
  largadaEditHref,
  largadaNovaHref,
  leadBack,
} from "./back";

describe("largada hrefs", () => {
  it("builds nova and edit URLs", () => {
    expect(largadaNovaHref).toBe("/largada?nova=1");
    expect(largadaEditHref("abc", "listas")).toBe(
      "/largada?fromSearch=abc&from=listas",
    );
  });

  it("sends grid back to nova lista with prefill when origin is largada", () => {
    expect(gridBack("largada", "abc")).toEqual({
      href: "/largada?fromSearch=abc&from=largada",
      label: "Voltar à nova lista",
    });
  });

  it("sends a ficha opened from Empresas back to Empresas", () => {
    expect(leadBack(null, "empresas")).toEqual(BACK.empresas);
    expect(leadBack("abc", "empresas")).toEqual({
      href: "/grid/abc?from=box",
      label: "Voltar ao Grid",
    });
  });

  it("keeps Box/Listas back without rewriting to nova lista", () => {
    expect(gridBack("box", "abc")).toEqual(BACK.box);
    expect(gridBack("listas")).toEqual(BACK.listas);
  });
});
