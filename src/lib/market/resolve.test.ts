import { describe, expect, it } from "vitest";
import { TAXONOMY } from "@/lib/niches";
import { GENERIC_PACK, getMarketPack } from "./packs";
import {
  matchSlugFromCnae,
  pickMarketPack,
  resolveMarketBrief,
  resolveMarketPackForPonte,
  seasonalHookActive,
} from "./resolve";

describe("pickMarketPack", () => {
  it("uses the segment pack when the slug exists", () => {
    const pack = pickMarketPack({
      presetSlug: "hamburguerias",
      parentSlug: "alimentacao-fora-do-lar",
      cnaeDescricao: "Lanchonetes",
    });
    expect(pack.slug).toBe("hamburguerias");
    expect(pack.perguntaConsideracao).toMatch(/semanas mortas/i);
  });

  it("falls back to the parent niche", () => {
    const pack = pickMarketPack({
      presetSlug: "lanchonetes",
      parentSlug: "alimentacao-fora-do-lar",
      cnaeDescricao: "Lanchonetes",
    });
    expect(pack.slug).toBe("alimentacao-fora-do-lar");
  });

  it("matches ótica from the CNAE description", () => {
    const hit = matchSlugFromCnae("Comércio varejista de artigos de óptica");
    expect(hit?.slug).toBe("oticas");
    const pack = pickMarketPack({
      cnaeDescricao: "Comércio varejista de artigos de óptica",
    });
    expect(pack.slug).toBe("oticas");
  });

  it("uses the generic pack when nothing matches", () => {
    expect(
      pickMarketPack({ cnaeDescricao: "Atividade espacial não catalogada" }).slug,
    ).toBe(GENERIC_PACK.slug);
  });
});

describe("pack coverage", () => {
  it("has a pack for every parent niche in the taxonomy", () => {
    const missing = TAXONOMY.filter((n) => !getMarketPack(n.slug)).map((n) => n.slug);
    expect(missing).toEqual([]);
  });
});

describe("resolveMarketPackForPonte", () => {
  it("keeps the list pack when the CNAE is the same niche", () => {
    const pack = resolveMarketPackForPonte({
      presetSlug: "clinicas-estetica",
      parentSlug: "estetica-e-beleza",
      cnaeDescricao: "Atividades de estética e outros serviços de cuidados com a beleza",
      municipioNome: "Belo Horizonte",
    });
    expect(pack.slug).toBe("clinicas-estetica");
    expect(pack.pontePorSinal["sem-mensuracao"]).toMatch(/clínica de estética/i);
  });

  it("uses the CNAE pack when the lead is not the list niche", () => {
    const pack = resolveMarketPackForPonte({
      presetSlug: "clinicas-estetica",
      parentSlug: "estetica-e-beleza",
      cnaeDescricao: "Consultoria em gestão empresarial",
      municipioNome: "Belo Horizonte",
    });
    expect(pack.slug).not.toBe("clinicas-estetica");
    expect(pack.pontePorSinal["sem-mensuracao"]).not.toMatch(/clínica de estética/i);
  });
});

describe("resolveMarketBrief", () => {
  it("fills the city into the pain line", () => {
    const brief = resolveMarketBrief({
      presetSlug: "oticas",
      cnaeDescricao: "Comércio varejista de artigos de óptica",
      municipioNome: "Belo Horizonte",
    });
    expect(brief.dorPrincipal).toContain("Belo Horizonte");
    expect(brief.dorPrincipal).not.toContain("{cidade}");
    expect(brief.janelaHorario).toMatch(/manhã/i);
    expect(brief.dorChip).toBe("Calçada e médico");
    expect(brief.janelaChip).toMatch(/manhã/i);
    expect(brief.sazonalidadeMeses.length).toBeGreaterThan(0);
  });

  it("marks seasonality active in the window", () => {
    const hook = getMarketPack("hamburguerias")!.sazonalidade;
    expect(seasonalHookActive(hook, new Date("2026-06-01"))).toBe(true);
    expect(seasonalHookActive(hook, new Date("2026-03-01"))).toBe(false);
  });
});
