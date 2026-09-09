import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "@/lib/types";
import {
  matchingSavedListCount,
  pipelineRemovalTransferReason,
  shouldRemoveEntradaDeal,
  summarizePipelineRemoval,
} from "./pipeline-removal";

describe("summarizePipelineRemoval", () => {
  it("allows a direct delete when every deal is GRID Entrada and there is no inbound", () => {
    const preview = summarizePipelineRemoval({
      isLastPipeline: false,
      inboundCount: 0,
      matchingSavedListCount: 2,
      deals: [
        { outcome: "open", source: "qualify_bridge", canonicalKey: "entrada" },
        { outcome: "open", canonicalKey: "entrada" },
      ],
    });
    expect(preview.canDeleteDirectly).toBe(true);
    expect(preview.entradaCount).toBe(2);
    expect(preview.advancedCount).toBe(0);
    expect(preview.matchingSavedListCount).toBe(2);
  });

  it("blocks a direct delete when a deal advanced, is user-owned, inbound exists, or it is the last nicho", () => {
    expect(
      summarizePipelineRemoval({
        isLastPipeline: false,
        inboundCount: 0,
        matchingSavedListCount: 0,
        deals: [
          {
            outcome: "open",
            source: "qualify_bridge",
            canonicalKey: "tentando_contato",
          },
        ],
      }).canDeleteDirectly,
    ).toBe(false);
    expect(
      summarizePipelineRemoval({
        isLastPipeline: false,
        inboundCount: 0,
        matchingSavedListCount: 0,
        deals: [
          { outcome: "open", source: "import", canonicalKey: "entrada" },
        ],
      }).userOwnedCount,
    ).toBe(1);
    expect(
      summarizePipelineRemoval({
        isLastPipeline: false,
        inboundCount: 1,
        matchingSavedListCount: 0,
        deals: [
          { outcome: "open", source: "qualify_bridge", canonicalKey: "entrada" },
        ],
      }).canDeleteDirectly,
    ).toBe(false);
    expect(
      summarizePipelineRemoval({
        isLastPipeline: true,
        inboundCount: 0,
        matchingSavedListCount: 0,
        deals: [],
      }).canDeleteDirectly,
    ).toBe(false);
  });

  it("does not treat inbound-only, user-owned Entrada, or empty boards as advanced", () => {
    const inboundOnly = summarizePipelineRemoval({
      isLastPipeline: false,
      inboundCount: 1,
      matchingSavedListCount: 0,
      deals: [],
    });
    expect(inboundOnly.advancedCount).toBe(0);
    expect(inboundOnly.canDeleteDirectly).toBe(false);
    expect(pipelineRemovalTransferReason(inboundOnly)).toBe("inbound");

    const userOwned = summarizePipelineRemoval({
      isLastPipeline: false,
      inboundCount: 0,
      matchingSavedListCount: 0,
      deals: [{ outcome: "open", source: "import", canonicalKey: "entrada" }],
    });
    expect(userOwned.advancedCount).toBe(0);
    expect(pipelineRemovalTransferReason(userOwned)).toBe("user_owned");

    const emptyLast = summarizePipelineRemoval({
      isLastPipeline: true,
      inboundCount: 0,
      matchingSavedListCount: 0,
      deals: [],
    });
    expect(emptyLast.advancedCount).toBe(0);
    expect(pipelineRemovalTransferReason(emptyLast)).toBe("last");

    const empty = summarizePipelineRemoval({
      isLastPipeline: false,
      inboundCount: 0,
      matchingSavedListCount: 0,
      deals: [],
    });
    expect(empty.advancedCount).toBe(0);
    expect(empty.canDeleteDirectly).toBe(true);
    expect(pipelineRemovalTransferReason(empty)).toBe(null);
  });

  it("names advanced deals as the transfer reason when a card left Entrada", () => {
    const preview = summarizePipelineRemoval({
      isLastPipeline: false,
      inboundCount: 1,
      matchingSavedListCount: 0,
      deals: [
        {
          outcome: "open",
          source: "qualify_bridge",
          canonicalKey: "tentando_contato",
        },
      ],
    });
    expect(preview.advancedCount).toBe(1);
    expect(pipelineRemovalTransferReason(preview)).toBe("advanced");
  });
});

describe("shouldRemoveEntradaDeal", () => {
  it("drops only GRID Entrada cards from that list", () => {
    expect(
      shouldRemoveEntradaDeal({
        listSearchId: "s1",
        searchId: "s1",
        source: "catchup_bridge",
        outcome: "open",
        canonicalKey: "entrada",
      }),
    ).toBe(true);
    expect(
      shouldRemoveEntradaDeal({
        listSearchId: "s1",
        searchId: "s1",
        source: "import",
        outcome: "open",
        canonicalKey: "entrada",
      }),
    ).toBe(false);
    expect(
      shouldRemoveEntradaDeal({
        listSearchId: "s1",
        searchId: "s1",
        source: "qualify_bridge",
        outcome: "open",
        canonicalKey: "tentando_contato",
      }),
    ).toBe(false);
    expect(
      shouldRemoveEntradaDeal({
        listSearchId: "s1",
        searchId: "other",
        source: "qualify_bridge",
        outcome: "open",
        canonicalKey: "entrada",
      }),
    ).toBe(false);
  });
});

describe("matchingSavedListCount", () => {
  it("counts saved lists that resolve to the nicho nome", () => {
    const search = {
      id: "s1",
      user_id: "u",
      nome: "Lista · Clínicas estética",
      filtros: {
        ...DEFAULT_FILTERS,
        segmentIds: ["seg-1"],
      },
      total_found: 1,
      created_at: "2026-09-01T00:00:00.000Z",
      saved: true,
    };
    expect(
      matchingSavedListCount(
        [search],
        "Clínicas estética",
        new Map([["seg-1", "Clínicas estética"]]),
      ),
    ).toBe(1);
    expect(
      matchingSavedListCount(
        [{ ...search, saved: false }],
        "Clínicas estética",
        new Map([["seg-1", "Clínicas estética"]]),
      ),
    ).toBe(0);
  });
});
