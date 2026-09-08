import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import type { CrmPipelineSummary } from "@/lib/crm/types";

const createCrmPipeline = vi.hoisted(() => vi.fn());

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ createCrmPipeline }),
}));

import { ensureDefaultPipeline } from "./ensure-pipeline";

describe("ensureDefaultPipeline", () => {
  beforeEach(() => {
    createCrmPipeline.mockReset();
  });

  it("returns the listed pipelines without creating", async () => {
    const listed: CrmPipelineSummary[] = [
      {
        id: "p1",
        user_id: "u1",
        nome: "Clínicas",
        position: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        deal_count: 3,
      },
    ];
    await expect(ensureDefaultPipeline("u1", listed)).resolves.toBe(listed);
    expect(createCrmPipeline).not.toHaveBeenCalled();
  });

  it("creates one pipeline and skips the extra list", async () => {
    createCrmPipeline.mockResolvedValue({
      id: "p-new",
      user_id: "u1",
      nome: DEFAULT_PIPELINE_NAME,
      position: 0,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    await expect(ensureDefaultPipeline("u1", [])).resolves.toEqual([
      {
        id: "p-new",
        user_id: "u1",
        nome: DEFAULT_PIPELINE_NAME,
        position: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        deal_count: 0,
      },
    ]);
    expect(createCrmPipeline).toHaveBeenCalledWith("u1", DEFAULT_PIPELINE_NAME);
  });
});
