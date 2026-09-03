import { describe, expect, it } from "vitest";
import ibgeCnaes from "@/lib/data/ibge-cnae-fixture.json";
import {
  PRESET_SEED,
  resolveCnaesFromKeywords,
} from "@/lib/niches";
import { normalizeText } from "@/lib/normalize-text";
import type { RefCnae } from "@/lib/types";

const OFFICIAL: RefCnae[] = ibgeCnaes.map((row) => ({
  codigo: String(row.codigo).trim(),
  descricao: row.descricao,
}));

const segments = PRESET_SEED.filter((p) => p.parent_slug);

describe("niche segment CNAE coverage (IBGE/Receita)", () => {
  it("resolves at least one official CNAE for every segment", () => {
    const empty = segments.filter(
      (seg) =>
        resolveCnaesFromKeywords(seg.keywords, seg.exclusoes, OFFICIAL)
          .length === 0,
    );
    expect(
      empty.map((s) => s.slug),
      "segments with 0 CNAEs against official ref_cnae",
    ).toEqual([]);
  });

  it("maps lavanderias to the three 9601 subclasses", () => {
    const seg = segments.find((s) => s.slug === "lavanderias");
    expect(seg).toBeDefined();
    const matched = resolveCnaesFromKeywords(
      seg!.keywords,
      seg!.exclusoes,
      OFFICIAL,
    );
    expect(matched.map((c) => normalizeText(c.descricao)).sort()).toEqual([
      "lavanderias",
      "tinturarias",
      "toalheiros",
    ]);
  });

  it("does not drop any seeded segment", () => {
    expect(segments.length).toBeGreaterThanOrEqual(210);
  });
});
