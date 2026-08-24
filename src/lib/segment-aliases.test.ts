import { describe, expect, it } from "vitest";
import { presetMatchesQuery, rankPresetMatch } from "@/lib/segment-aliases";
import { PRESET_SEED, TAXONOMY } from "@/lib/niches";

describe("segment aliases findability", () => {
  it("finds águas envasadas via commercial terms under Indústria", () => {
    const agua = PRESET_SEED.find((p) => p.slug === "aguas-envasadas");
    expect(agua).toBeTruthy();
    expect(agua!.parent_slug).toBe("industria");
    expect(presetMatchesQuery(agua!, "envasadoras de agua")).toBe(true);
    expect(rankPresetMatch(agua!, "envasadoras de agua")).toBeGreaterThanOrEqual(70);
  });

  it("puts co-packing under Indústria, not Logística", () => {
    const pack = PRESET_SEED.find((p) => p.slug === "envasamento-empacotamento");
    expect(pack).toBeTruthy();
    expect(pack!.parent_slug).toBe("industria");
    expect(pack!.nome.toLowerCase()).toContain("co-packing");
    expect(presetMatchesQuery(pack!, "empacotamento sob contrato")).toBe(true);
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
    expect(
      PRESET_SEED.find((p) => p.slug === "distribuidoras-atacado")?.parent_slug,
    ).toBe("atacado-e-distribuicao");
    expect(PRESET_SEED.find((p) => p.slug === "marketing-digital")?.parent_slug).toBe(
      "marketing-e-publicidade",
    );
  });

  it("seeds aliases onto many segments", () => {
    const withAliases = PRESET_SEED.filter((p) => p.aliases.length > 0);
    expect(withAliases.length).toBeGreaterThan(80);
  });
});
