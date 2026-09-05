import { describe, expect, it } from "vitest";
import { dealCnpjsQuerySchema, dealPatchSchema } from "./schema";

describe("dealPatchSchema amount_cents", () => {
  it("accepts cents, null, and omits when absent", () => {
    expect(dealPatchSchema.parse({ amount_cents: 150000 }).amount_cents).toBe(
      150000,
    );
    expect(dealPatchSchema.parse({ amount_cents: null }).amount_cents).toBeNull();
    expect(dealPatchSchema.parse({ notes: "ok" }).amount_cents).toBeUndefined();
  });

  it("rejects fractions and overflow", () => {
    expect(dealPatchSchema.safeParse({ amount_cents: 1.5 }).success).toBe(false);
    expect(dealPatchSchema.safeParse({ amount_cents: -1 }).success).toBe(false);
    expect(
      dealPatchSchema.safeParse({ amount_cents: 10_000_000_000 }).success,
    ).toBe(false);
  });
});

describe("dealCnpjsQuerySchema", () => {
  it("normalizes, dedupes, and skips empty parts", () => {
    expect(
      dealCnpjsQuerySchema.parse("12.345.678/0001-90,12345678000190,,00000000000191"),
    ).toEqual(["12345678000190", "00000000000191"]);
  });

  it("caps the lookup at 50 CNPJs", () => {
    const raw = Array.from({ length: 60 }, (_, i) =>
      String(i + 1).padStart(14, "0"),
    ).join(",");
    expect(dealCnpjsQuerySchema.parse(raw)).toHaveLength(50);
  });
});
