import { describe, expect, it } from "vitest";
import {
  BACK,
  conexoesHref,
  crmHref,
  gridBack,
  largadaEditHref,
  largadaIntentHref,
  largadaNovaHref,
  leadBack,
  leadHrefForCnpj,
} from "./back";

describe("largada hrefs", () => {
  it("builds nova and edit URLs", () => {
    expect(largadaNovaHref).toBe("/largada?nova=1");
    expect(largadaIntentHref("madeireira")).toBe(
      "/largada?nova=1&intent=madeireira",
    );
    expect(largadaIntentHref("mineração", { uf: "rj" })).toBe(
      "/largada?nova=1&intent=minera%C3%A7%C3%A3o&uf=RJ",
    );
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
      href: "/grid/abc?from=empresas",
      label: "Voltar à lista",
    });
  });

  it("keeps Box/Listas back without rewriting to nova lista", () => {
    expect(gridBack("box", "abc")).toEqual(BACK.box);
    expect(gridBack("listas")).toEqual(BACK.listas);
  });

  it("sends unknown grid origin to the Painel", () => {
    expect(gridBack(null)).toEqual(BACK.painel);
    expect(leadBack(null, null)).toEqual(BACK.painel);
  });
});

describe("conexoesHref", () => {
  it("deep-links CRM and VoIP", () => {
    expect(conexoesHref()).toBe("/conexoes");
    expect(conexoesHref("crm")).toBe("/conexoes?kind=crm");
    expect(conexoesHref("voip")).toBe("/conexoes?kind=voip");
  });
});

describe("crm and ficha hrefs", () => {
  it("opens a deal on the native board", () => {
    expect(crmHref()).toBe("/crm");
    expect(crmHref({ pipeline: "p1", deal: "d1" })).toBe(
      "/crm?pipeline=p1&deal=d1",
    );
  });

  it("opens the ficha from a CRM deal", () => {
    expect(leadHrefForCnpj("12.345.678/0001-90")).toBe("/lead/12345678000190");
    expect(leadHrefForCnpj("12345678000190", "search-1")).toBe(
      "/lead/12345678000190?searchId=search-1&from=listas",
    );
  });
});
