import { describe, expect, it } from "vitest";
import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import {
  matchPresetForCnae,
  pipelineNomeForCompany,
} from "@/lib/crm/pipeline-from-cnae";
import type { NichePreset } from "@/lib/types";

const segment: NichePreset = {
  id: "seg-1",
  slug: "aguas",
  nome: "Águas minerais",
  grupo: "b2b_industria",
  perfil_score: "b2b_industria",
  parent_id: "root-1",
  keywords: ["agua mineral"],
  exclusoes: [],
  name_stems: [],
  aliases: [],
  curado: true,
  ordem: 1,
};

describe("pipeline from CNAE", () => {
  it("matches a curated segment before falling back to the CNAE label", () => {
    expect(
      matchPresetForCnae("1128000", [segment], [
        { preset_id: "seg-1", cnae: "1128000", incluido: true },
      ], [])?.id,
    ).toBe("seg-1");
    expect(
      pipelineNomeForCompany({
        presetNome: segment.nome,
        cnaeDescricao: "Fabricação de águas envasadas",
      }),
    ).toBe("Águas minerais");
  });

  it("uses the CNAE description when no preset matches", () => {
    expect(matchPresetForCnae("0000000", [segment], [], [])).toBeNull();
    expect(
      pipelineNomeForCompany({
        cnaeDescricao: "Fabricação de águas envasadas",
      }),
    ).toBe("Fabricação de águas envasadas");
    expect(pipelineNomeForCompany({})).toBe(DEFAULT_PIPELINE_NAME);
  });
});
