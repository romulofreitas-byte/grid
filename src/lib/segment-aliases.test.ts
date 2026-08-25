import { describe, expect, it } from "vitest";
import {
  cnaeMatchesQuery,
  presetMatchesQuery,
  rankPresetMatch,
  textMatchesQuery,
} from "@/lib/segment-aliases";
import { PRESET_SEED, TAXONOMY } from "@/lib/niches";

function seed(slug: string) {
  const row = PRESET_SEED.find((p) => p.slug === slug);
  expect(row, slug).toBeTruthy();
  return row!;
}

describe("segment aliases findability", () => {
  it("finds águas envasadas via commercial terms under Indústria", () => {
    const agua = seed("aguas-envasadas");
    expect(agua.parent_slug).toBe("industria");
    expect(presetMatchesQuery(agua, "envasadoras de agua")).toBe(true);
    expect(rankPresetMatch(agua, "envasadoras de agua")).toBeGreaterThanOrEqual(70);
  });

  it("puts co-packing under Indústria, not Logística", () => {
    const pack = seed("envasamento-empacotamento");
    expect(pack.parent_slug).toBe("industria");
    expect(pack.nome.toLowerCase()).toContain("co-packing");
    expect(presetMatchesQuery(pack, "empacotamento sob contrato")).toBe(true);
  });

  it("does not send water bottlers to logística", () => {
    const logistica = TAXONOMY.find((n) => n.slug === "logistica-e-transporte");
    expect(logistica?.segments.some((s) => s.slug === "envasamento-empacotamento")).toBe(
      false,
    );
    expect(logistica?.segments.some((s) => s.slug === "distribuidoras-atacado")).toBe(
      false,
    );
  });

  it("homes atacado and marketing in their own niches", () => {
    expect(seed("distribuidoras-atacado").parent_slug).toBe("atacado-e-distribuicao");
    expect(seed("marketing-digital").parent_slug).toBe("marketing-e-publicidade");
  });

  it("seeds aliases onto many segments", () => {
    const withAliases = PRESET_SEED.filter((p) => p.aliases.length > 0);
    expect(withAliases.length).toBeGreaterThan(80);
  });
});

describe("commercial term findability", () => {
  it("finds barbearia as its own segment, not only salão premium", () => {
    const barber = seed("barbearias");
    expect(barber.parent_slug).toBe("estetica-e-beleza");
    expect(presetMatchesQuery(barber, "barbearia")).toBe(true);
    expect(presetMatchesQuery(barber, "barbeiro")).toBe(true);
    expect(rankPresetMatch(barber, "barbearia")).toBeGreaterThanOrEqual(95);
    expect(presetMatchesQuery(seed("saloes-premium"), "barbearia")).toBe(false);
  });

  it("finds clínica médica in health, not só estética", () => {
    const clinica = seed("clinicas-medicas");
    const parent = seed("saude-e-clinicas");
    expect(presetMatchesQuery(clinica, "clínica médica")).toBe(true);
    expect(presetMatchesQuery(clinica, "clinica medica")).toBe(true);
    expect(rankPresetMatch(clinica, "clinica medica")).toBeGreaterThanOrEqual(95);
    expect(presetMatchesQuery(parent, "clinica medica")).toBe(true);
    expect(presetMatchesQuery(seed("clinicas-estetica"), "clinica medica")).toBe(false);
  });

  it("finds dentista in odontologia", () => {
    const odonto = seed("odontologia");
    expect(presetMatchesQuery(odonto, "dentista")).toBe(true);
    expect(rankPresetMatch(odonto, "dentista")).toBeGreaterThanOrEqual(70);
  });

  it("maps farmácia to varejo, not indústria farmacêutica", () => {
    const retail = seed("farmacias-drogarias");
    const industry = seed("farmaceutica");
    expect(retail.parent_slug).toBe("varejo");
    expect(presetMatchesQuery(retail, "farmácia")).toBe(true);
    expect(presetMatchesQuery(retail, "farmacia")).toBe(true);
    expect(presetMatchesQuery(industry, "farmacia")).toBe(false);
    expect(rankPresetMatch(retail, "farmacia")).toBeGreaterThan(
      rankPresetMatch(industry, "farmacia"),
    );
  });

  it("finds academia, supermercado, posto, lavanderia and tatuagem", () => {
    expect(presetMatchesQuery(seed("academias"), "academia")).toBe(true);
    expect(presetMatchesQuery(seed("supermercados"), "supermercado")).toBe(true);
    expect(presetMatchesQuery(seed("postos-combustivel"), "posto de gasolina")).toBe(
      true,
    );
    expect(presetMatchesQuery(seed("lavanderias"), "lavanderia")).toBe(true);
    expect(presetMatchesQuery(seed("estudio-tatuagem"), "tatuagem")).toBe(true);
  });
});

describe("token matching", () => {
  it("matches CNAE descriptions that do not contain the whole phrase", () => {
    expect(
      textMatchesQuery("Atividade medica ambulatorial clinica", "clinica medica"),
    ).toBe(true);
    expect(cnaeMatchesQuery("8630501", "Atividade medica ambulatorial clinica", "clínica médica")).toBe(
      true,
    );
    expect(
      cnaeMatchesQuery("9602501", "Cabeleireiros e salao de beleza premium", "barbearia"),
    ).toBe(false);
  });

  it("does not let short aliases swallow longer queries", () => {
    expect(presetMatchesQuery(seed("bares"), "barbearia")).toBe(false);
  });
});
