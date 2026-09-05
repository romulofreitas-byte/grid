import { describe, expect, it } from "vitest";
import { qualifyCrmHint, type PublicCrmBridge } from "./bridge";
import { COPY } from "@/lib/copy";

function bridge(patch: Partial<PublicCrmBridge> = {}): PublicCrmBridge {
  return {
    created: 0,
    skipped: 0,
    failed: 0,
    pipelineId: "pipe-1",
    pipelineNome: "Clínicas",
    error: null,
    ...patch,
  };
}

describe("qualifyCrmHint", () => {
  it("asks to save the list when it is not saved", () => {
    expect(qualifyCrmHint(false, bridge({ created: 1 }))).toEqual({
      hint: COPY.crmSaveListToEnter,
      pipelineId: null,
    });
  });

  it("shows created leads", () => {
    expect(qualifyCrmHint(true, bridge({ created: 1 }))).toEqual({
      hint: "1 lead no CRM · Clínicas",
      pipelineId: "pipe-1",
    });
  });

  it("shows already on the board when nothing failed", () => {
    expect(qualifyCrmHint(true, bridge({ skipped: 1 }))).toEqual({
      hint: COPY.crmOnGrid,
      pipelineId: "pipe-1",
    });
  });

  it("surfaces a failure instead of hanging on Colocando no CRM", () => {
    expect(qualifyCrmHint(true, bridge({ failed: 1 }))).toEqual({
      hint: COPY.crmBridgeFailed,
      pipelineId: "pipe-1",
    });
    expect(qualifyCrmHint(true, null).hint).toBe(COPY.crmBridgeFailed);
  });
});
