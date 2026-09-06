import { describe, expect, it } from "vitest";
import { displayCrmName, isAllCapsName } from "./display-name";

describe("isAllCapsName", () => {
  it("detects Receita-style uppercase", () => {
    expect(isAllCapsName("TRANSCOR INDUSTRIA DE PIGMENTOS LTDA")).toBe(true);
    expect(isAllCapsName("ANTONIO CARLOS SARETTI")).toBe(true);
  });

  it("leaves mixed or lowercase names alone", () => {
    expect(isAllCapsName("Marmoraria Carvalho")).toBe(false);
    expect(isAllCapsName("transcor industria")).toBe(false);
  });
});

describe("displayCrmName", () => {
  it("title-cases an ALL CAPS razão social and keeps legal suffixes", () => {
    expect(
      displayCrmName("TRANSCOR INDUSTRIA DE PIGMENTOS E CORANTES LTDA"),
    ).toBe("Transcor Industria de Pigmentos e Corantes LTDA");
  });

  it("title-cases a contact name", () => {
    expect(displayCrmName("ANTONIO CARLOS SARETTI")).toBe(
      "Antonio Carlos Saretti",
    );
  });

  it("keeps S.A. / ME / EIRELI uppercase", () => {
    expect(displayCrmName("ACME INDUSTRIA ME")).toBe("Acme Industria ME");
    expect(displayCrmName("FOO BAR EIRELI")).toBe("Foo Bar EIRELI");
    expect(displayCrmName("ACME S.A.")).toBe("Acme S.A.");
  });

  it("does not rewrite mixed-case names the piloto already typed", () => {
    expect(displayCrmName("Marmoraria Carvalho")).toBe("Marmoraria Carvalho");
    expect(displayCrmName("João da Silva")).toBe("João da Silva");
  });

  it("collapses extra spaces and ignores empty input", () => {
    expect(displayCrmName("  ACME   LTDA  ")).toBe("Acme LTDA");
    expect(displayCrmName("   ")).toBe("");
  });
});
