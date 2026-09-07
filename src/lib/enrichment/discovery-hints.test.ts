import { describe, expect, it } from "vitest";
import { parseDiscoveryHints } from "./discovery-hints";

describe("parseDiscoveryHints", () => {
  it("reads labeled import notes for Metalúrgica Vaz", () => {
    const hints = parseDiscoveryHints({
      companyName: "Metalúrgica Vaz",
      notes: [
        "Site: http://www.metalurgicavaz.com.br",
        "Endereço: Rod. Anel Rodoviário",
        "Nome no Maps: Metalúrgica Vaz Contagem",
      ].join("\n"),
    });
    expect(hints.names).toEqual(
      expect.arrayContaining(["Metalúrgica Vaz", "Metalúrgica Vaz Contagem"]),
    );
    expect(hints.domain).toBe("metalurgicavaz.com.br");
    expect(hints.instagram).toBeNull();
  });

  it("extracts Instagram handles and Maps place names", () => {
    const hints = parseDiscoveryHints({
      notes:
        "Instagram: @metalurgica.vaz\nhttps://www.google.com/maps/place/Metalurgica+Vaz/@-19.9,-44.0",
    });
    expect(hints.instagram).toBe("metalurgica.vaz");
    expect(hints.names).toContain("Metalurgica Vaz");
  });
});
