import { describe, expect, it } from "vitest";
import { TAXONOMY } from "@/lib/niches";
import {
  lookupMunition,
  lookupSeason,
  munitionPackCount,
  redactMarketBrief,
  seasonPackCount,
} from "./munition";
import { resolveMarketBrief } from "./resolve";

describe("niche munition packs", () => {
  it("covers every parent niche", () => {
    expect(munitionPackCount()).toBe(20);
    const missing = TAXONOMY.filter((n) => !lookupMunition(n.slug)).map(
      (n) => n.slug,
    );
    expect(missing).toEqual([]);
  });

  it("inherits parent munition on a segment slug", () => {
    const inherited = lookupMunition("hamburguerias");
    const parent = lookupMunition("alimentacao-fora-do-lar");
    expect(inherited?.doresFaturamento[0]).toBe(parent?.doresFaturamento[0]);
    expect(inherited?.termosRamo).toContain("taxa do aplicativo");
  });
});

describe("niche season packs", () => {
  it("covers every parent niche", () => {
    expect(seasonPackCount()).toBe(20);
    const missing = TAXONOMY.filter((n) => !lookupSeason(n.slug)).map(
      (n) => n.slug,
    );
    expect(missing).toEqual([]);
  });

  it("inherits parent season on a segment slug", () => {
    expect(lookupSeason("funilaria-pintura")?.chip).toBe("IPVA");
    expect(lookupSeason("oticas")?.chip).toBe("Natal");
    expect(lookupSeason("hamburguerias")?.chip).toBe("Dia dos Namorados");
  });
});

describe("redactMarketBrief", () => {
  const brief = resolveMarketBrief({
    presetSlug: "estetica-e-beleza",
    cnaeDescricao: "Cabeleireiros",
    municipioNome: "Belo Horizonte",
  });

  it("keeps the full pack on Piloto Pro", () => {
    const out = redactMarketBrief(brief, "piloto_pro");
    expect(out.munitionLocked).toBe(false);
    expect(out.munition?.urgenciasOcultas).toHaveLength(3);
    expect(out.munition?.termosRamo).toHaveLength(8);
    expect(out.dorCaixa).toMatch(/cadeira parada/i);
  });

  it("keeps one caixa pain on Piloto and drops the rest", () => {
    const out = redactMarketBrief(brief, "piloto");
    expect(out.dorCaixa).toBe(brief.munition?.doresFaturamento[0]);
    expect(out.munition).toBeNull();
    expect(out.munitionLocked).toBe(true);
    expect(JSON.stringify(out)).not.toMatch(/salão novo do bairro/i);
  });

  it("hides the teaser on Treino livre", () => {
    const out = redactMarketBrief(brief, "free");
    expect(out.dorCaixa).toBeNull();
    expect(out.munition).toBeNull();
    expect(out.munitionLocked).toBe(false);
    expect(JSON.stringify(out)).not.toMatch(/cadeira parada é prejuízo/i);
  });

  it("treats the platform coupon like Piloto", () => {
    const out = redactMarketBrief(brief, "membro_plataforma");
    expect(out.munitionLocked).toBe(true);
    expect(out.munition).toBeNull();
    expect(out.dorCaixa).toBeTruthy();
  });

  it("keeps the munition call window after redact", () => {
    const auto = resolveMarketBrief({
      presetSlug: "automotivo",
      cnaeDescricao: "Oficinas mecânicas",
      municipioNome: "Patos de Minas",
    });
    const piloto = redactMarketBrief(auto, "piloto");
    expect(piloto.munition).toBeNull();
    expect(piloto.janelaChip).toMatch(/tarde/i);
    expect(piloto.janelaEvitar).toMatch(/manhã/i);
    const free = redactMarketBrief(auto, "free");
    expect(free.janelaChip).toMatch(/tarde/i);
    expect(free.janelaEvitar).toMatch(/manhã/i);
    expect(free.sazonalidadeChip).toBe("IPVA");
    expect(piloto.sazonalidadeChip).toBe("IPVA");
    expect(piloto.sazonalidadeMeses).toEqual([1, 3, 12]);
  });
});
