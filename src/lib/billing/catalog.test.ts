import { describe, expect, it } from "vitest";
import {
  ENRICH_CREDIT_COST,
  formatBrl,
  getCatalogItem,
  orderKindFor,
  PACKS,
  PLANS,
} from "./catalog";

describe("catalog", () => {
  it("keeps approved plan prices", () => {
    expect(getCatalogItem("piloto")?.priceCents).toBe(9_700);
    expect(getCatalogItem("piloto_pro")?.priceCents).toBe(19_700);
    expect(getCatalogItem("escuderia")?.priceCents).toBe(39_700);
    expect(getCatalogItem("piloto")?.credits).toBe(900);
  });

  it("blocks enrichment on free", () => {
    const free = getCatalogItem("free");
    expect(free).toMatchObject({
      kind: "plan",
      enrichAllowed: false,
      credits: 25,
    });
    expect(free?.kind === "plan" ? free.highlights : []).toContain(
      "Sem qualificação nem CRM",
    );
  });

  it("lists native CRM on Piloto", () => {
    const piloto = getCatalogItem("piloto");
    expect(piloto?.kind === "plan" ? piloto.highlights : []).toContain("CRM nativo");
  });

  it("prices packs above the subscription unit cost", () => {
    const piloto = getCatalogItem("piloto");
    if (!piloto || piloto.kind !== "plan") throw new Error("missing piloto");
    const perCredit = piloto.priceCents / piloto.credits;
    for (const pack of PACKS) {
      expect(pack.priceCents / pack.credits).toBeGreaterThan(perCredit);
    }
  });

  it("maps sku to order kind", () => {
    expect(orderKindFor("piloto")).toBe("subscription_cycle");
    expect(orderKindFor("pack_100")).toBe("credit_pack");
    expect(orderKindFor("membro_plataforma")).toBe("platform");
  });

  it("formats BRL", () => {
    expect(formatBrl(9_700)).toBe("R$ 97,00");
  });

  it("charges two credits per enrichment", () => {
    expect(ENRICH_CREDIT_COST).toBe(2);
    expect(PLANS).toHaveLength(5);
  });
});
