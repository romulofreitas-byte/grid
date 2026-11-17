import { describe, expect, it } from "vitest";
import { stripeOrderIdFromObject } from "@/lib/billing/providers/stripe";

describe("stripe order id", () => {
  it("reads metadata.order_id", () => {
    expect(
      stripeOrderIdFromObject({ metadata: { order_id: "ord-1" } }),
    ).toBe("ord-1");
  });

  it("falls back to client_reference_id", () => {
    expect(stripeOrderIdFromObject({ client_reference_id: "ord-2" })).toBe(
      "ord-2",
    );
  });
});
