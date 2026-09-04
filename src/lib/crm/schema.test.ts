import { describe, expect, it } from "vitest";
import { dealPatchSchema } from "./schema";

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
