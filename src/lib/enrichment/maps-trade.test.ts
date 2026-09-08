import { describe, expect, it } from "vitest";
import { gmbCnaeTradeLabels } from "./maps-trade";

describe("gmbCnaeTradeLabels", () => {
  it("uses the niche name plus a CNAE noun for vidraçarias", () => {
    expect(
      gmbCnaeTradeLabels("Comércio varejista de vidros"),
    ).toEqual(expect.arrayContaining(["Vidraçarias", "vidros"]));
  });

  it("keeps usinagem from a workshop CNAE", () => {
    expect(gmbCnaeTradeLabels("Serviços de usinagem, tornearia e solda")).toEqual(
      expect.arrayContaining(["usinagem"]),
    );
  });

  it("returns nothing without a CNAE description", () => {
    expect(gmbCnaeTradeLabels(null)).toEqual([]);
    expect(gmbCnaeTradeLabels("")).toEqual([]);
  });
});
