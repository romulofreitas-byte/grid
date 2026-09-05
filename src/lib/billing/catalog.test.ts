import { describe, expect, it } from "vitest";
import {
  ENRICH_CREDIT_COST,
  EXPORT_CREDIT_COST,
  creditsPhrase,
  formatBrl,
  getCatalogItem,
  isBilledPlanSku,
  isSkuOnSale,
  orderKindFor,
  planHasFeature,
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

  it("keeps CRM gated on Treino livre and advertises 25 qualifications", () => {
    const free = getCatalogItem("free");
    expect(free).toMatchObject({
      kind: "plan",
      enrichAllowed: false,
      credits: 25,
    });
    expect(free?.kind === "plan" ? free.highlights : []).toContain(
      "25 qualificações / mês",
    );
    expect(free?.kind === "plan" ? free.highlights : []).toContain(
      "CRM e export a partir do Piloto",
    );
  });

  it("lists native CRM, Meta and spreadsheet import on Piloto", () => {
    const piloto = getCatalogItem("piloto");
    const highlights = piloto?.kind === "plan" ? piloto.highlights : [];
    expect(highlights).toContain("CRM nativo");
    expect(highlights).toContain("Meta do dia no Box");
    expect(highlights).toContain("Importar planilha para o quadro");
    expect(highlights.join(" ")).not.toMatch(/automaç/i);
  });

  it("puts automations on Pro and Escuderia, not on Piloto or the platform coupon", () => {
    expect(planHasFeature("free", "crm")).toBe(false);
    expect(planHasFeature("free", "import")).toBe(false);
    expect(planHasFeature("free", "automations")).toBe(false);
    expect(planHasFeature("piloto", "crm")).toBe(true);
    expect(planHasFeature("piloto", "import")).toBe(true);
    expect(planHasFeature("piloto", "automations")).toBe(false);
    expect(planHasFeature("membro_plataforma", "crm")).toBe(true);
    expect(planHasFeature("membro_plataforma", "import")).toBe(true);
    expect(planHasFeature("membro_plataforma", "automations")).toBe(false);
    expect(planHasFeature("piloto_pro", "automations")).toBe(true);
    expect(planHasFeature("escuderia", "automations")).toBe(true);
    expect(planHasFeature("escuderia", "import")).toBe(true);
    expect(planHasFeature("unknown", "crm")).toBe(false);
    const pro = getCatalogItem("piloto_pro");
    const escuderia = getCatalogItem("escuderia");
    expect(pro?.kind === "plan" ? pro.highlights : []).toContain(
      "Automações: formulário, anúncio, Make",
    );
    expect(escuderia?.kind === "plan" ? escuderia.highlights : []).toContain(
      "Tudo do Piloto Pro",
    );
    expect(escuderia?.kind === "plan" ? escuderia.highlights : []).toContain(
      "Um usuário nesta versão",
    );
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

  it("sells Piloto, the platform coupon plan, and credit packs right now", () => {
    expect(isSkuOnSale("piloto")).toBe(true);
    expect(isSkuOnSale("membro_plataforma")).toBe(true);
    expect(isSkuOnSale("pack_100")).toBe(true);
    expect(isSkuOnSale("pack_500")).toBe(true);
    expect(isSkuOnSale("pack_2000")).toBe(true);
    expect(isSkuOnSale("free")).toBe(false);
    expect(isSkuOnSale("piloto_pro")).toBe(false);
    expect(isSkuOnSale("escuderia")).toBe(false);
  });

  it("formats BRL", () => {
    expect(formatBrl(9_700)).toBe("R$ 97,00");
  });

  it("sizes Piloto around a month of daily calls, not bulk export", () => {
    const piloto = getCatalogItem("piloto");
    const highlights = piloto?.kind === "plan" ? piloto.highlights : [];
    expect(highlights).toContain("~20 fichas por dia no mês");
    expect(highlights.join(" ")).not.toMatch(/export/i);
  });

  it("charges one credit to qualify and fifty to export", () => {
    expect(ENRICH_CREDIT_COST).toBe(1);
    expect(EXPORT_CREDIT_COST).toBe(50);
    expect(EXPORT_CREDIT_COST).toBeGreaterThan(ENRICH_CREDIT_COST);
    expect(creditsPhrase(1)).toBe("1 crédito");
    expect(creditsPhrase(10)).toBe("10 créditos");
    expect(PLANS).toHaveLength(5);
  });

  it("marks billed plans for ops MRR", () => {
    expect(isBilledPlanSku("piloto")).toBe(true);
    expect(isBilledPlanSku("piloto_pro")).toBe(true);
    expect(isBilledPlanSku("escuderia")).toBe(true);
    expect(isBilledPlanSku("free")).toBe(false);
    expect(isBilledPlanSku("membro_plataforma")).toBe(false);
  });
});
