import { describe, expect, it } from "vitest";
import {
  ENRICH_CREDIT_COST,
  EXPORT_CREDIT_COST,
  catalogBenefitLines,
  creditsPhrase,
  formatBrl,
  getCatalogItem,
  isBilledPlanSku,
  isSkuOnSale,
  orderKindFor,
  planHasFeature,
  PACKS,
  PLANS,
  type PlanDefinition,
} from "./catalog";

const GRID_PLANS = PLANS.filter((plan) => plan.sku !== "membro_plataforma");

function asPlan(sku: string): PlanDefinition {
  const item = getCatalogItem(sku);
  if (!item || item.kind !== "plan") throw new Error(`missing plan ${sku}`);
  return item;
}

const BLOCKER_COPY = /a partir do|não inclui|entra na próxima etapa/i;

describe("catalog", () => {
  it("keeps approved plan prices", () => {
    expect(getCatalogItem("piloto")?.priceCents).toBe(9_700);
    expect(getCatalogItem("piloto_pro")?.priceCents).toBe(19_700);
    expect(getCatalogItem("escuderia")?.priceCents).toBe(39_700);
    expect(getCatalogItem("piloto")?.credits).toBe(900);
  });

  it("keeps CRM gated on Treino livre and advertises 25 qualifications", () => {
    const free = asPlan("free");
    expect(free).toMatchObject({
      kind: "plan",
      enrichAllowed: false,
      credits: 25,
    });
    expect(free.highlights).toContain("25 qualificações / mês");
    expect(catalogBenefitLines(free).join(" ")).not.toMatch(/crm|export/i);
  });

  it("lists four face benefits on every pricing-grid plan", () => {
    for (const plan of GRID_PLANS) {
      expect(plan.highlights).toHaveLength(4);
      expect(plan.details.length).toBeGreaterThan(0);
    }
  });

  it("lists native CRM, Meta and spreadsheet import on Piloto", () => {
    const piloto = asPlan("piloto");
    expect(piloto.highlights).toContain("CRM nativo");
    expect(piloto.highlights).toContain("Meta do dia no Box");
    expect(piloto.details).toContain("Importar planilha para o quadro");
    expect(catalogBenefitLines(piloto).join(" ")).not.toMatch(/automaç/i);
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
    const pro = asPlan("piloto_pro");
    const escuderia = asPlan("escuderia");
    expect(pro.highlights).toContain("Automações: formulário, anúncio, Make");
    expect(pro.highlights).toContain("Tudo do Piloto");
    expect(escuderia.highlights).toContain("Tudo do Piloto Pro");
    expect(escuderia.notes).toContain("Seats extras em desenvolvimento");
  });

  it("does not sell blockers as checked benefits", () => {
    for (const plan of GRID_PLANS) {
      const lines = catalogBenefitLines(plan).join(" ");
      expect(lines).not.toMatch(BLOCKER_COPY);
      expect(lines).not.toMatch(/buscas de lista por dia/i);
    }
  });

  it("sells credit packs as extras that do not expire", () => {
    for (const pack of PACKS) {
      const lines = pack.highlights.join(" ");
      expect(lines).toMatch(/não expiram/i);
      expect(lines).not.toMatch(/não reabre|não substitui|custo por crédito/i);
    }
  });

  it("prices packs above the subscription unit cost", () => {
    const piloto = asPlan("piloto");
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
    const piloto = asPlan("piloto");
    expect(piloto.highlights).toContain("~20 fichas por dia no mês");
    expect(catalogBenefitLines(piloto).join(" ")).not.toMatch(/export/i);
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
