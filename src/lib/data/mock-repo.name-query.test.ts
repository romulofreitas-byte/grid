import { describe, expect, it } from "vitest";
import { mockRepo } from "@/lib/data/mock-repo";
import { DEFAULT_FILTERS } from "@/lib/types";

describe("mock name query search", () => {
  it("previewNames groups CNAEs of companies with the stem in the name", async () => {
    const preview = await mockRepo.previewNames("churras");
    expect(preview.total).toBeGreaterThan(0);
    expect(preview.cnaes.length).toBeGreaterThan(0);
    expect(preview.cnaes[0]?.nameHits).toBeGreaterThan(0);
  });

  it("count with nameQuery is tighter than CNAE-only", async () => {
    const preview = await mockRepo.previewNames("churras");
    expect(preview.total).toBeGreaterThan(0);
    const codes = preview.cnaes.map((c) => c.codigo);
    expect(codes.length).toBeGreaterThan(0);
    const qualityOff = { ocultarTelefonesCompartilhados: false as const };
    const byCnae = await mockRepo.count(
      {
        ...DEFAULT_FILTERS,
        ...qualityOff,
        cnaes: codes,
      },
      "total",
    );
    const byName = await mockRepo.count(
      {
        ...DEFAULT_FILTERS,
        ...qualityOff,
        nameQuery: "churras",
      },
      "total",
    );
    const byBoth = await mockRepo.count(
      {
        ...DEFAULT_FILTERS,
        ...qualityOff,
        cnaes: codes,
        nameQuery: "churras",
      },
      "total",
    );
    expect(byCnae.total).toBeGreaterThan(0);
    expect(byName.total).toBeGreaterThan(0);
    expect(byBoth.total).toBeGreaterThan(0);
    expect(byBoth.total).toBeLessThanOrEqual(byCnae.total);
    expect(byBoth.total).toBeLessThanOrEqual(byName.total);
  });
});
