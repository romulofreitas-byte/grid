import { describe, expect, it } from "vitest";
import { resolveOriginateTarget } from "./originate-target";

describe("resolveOriginateTarget", () => {
  it("counts the Grid lead when only CNPJ is present", () => {
    const target = resolveOriginateTarget({ cnpj: "12.345.678/0001-90" });
    expect(target.cnpj).toBe("12345678000190");
    expect(target.skipLeadRecord).toBe(false);
    expect(target.dealId).toBeNull();
  });

  it("dials a CRM number without CNPJ and skips the lead record", () => {
    const target = resolveOriginateTarget({
      to: "3134113893",
      dealId: "22222222-2222-4222-8222-222222222222",
    });
    expect(target.cnpj).toBe("");
    expect(target.rawTo).toBe("3134113893");
    expect(target.skipLeadRecord).toBe(true);
    expect(target.dealId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("skips the job-side record when the CRM card will complete the call", () => {
    const target = resolveOriginateTarget({
      cnpj: "12345678000190",
      to: "+553134113893",
      dealId: "22222222-2222-4222-8222-222222222222",
    });
    expect(target.cnpj).toBe("12345678000190");
    expect(target.skipLeadRecord).toBe(true);
  });
});
