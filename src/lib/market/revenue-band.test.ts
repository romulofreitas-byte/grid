import { describe, expect, it } from "vitest";
import { estimateRevenueBand } from "./revenue-band";

describe("estimateRevenueBand", () => {
  it("returns null without porte", () => {
    expect(estimateRevenueBand({ porte: null })).toBeNull();
  });

  it("maps ME to Simples-like band with disclaimer", () => {
    const band = estimateRevenueBand({ porte: "01", capitalSocial: 10_000 });
    expect(band?.bandId).toBe("ate_360k");
    expect(band?.regimeHint).toMatch(/Simples/i);
    expect(band?.basis).toMatch(/não é faturamento oficial/i);
    expect(band?.confidence).toBe("media");
  });

  it("lowers ME confidence when capital is high", () => {
    const band = estimateRevenueBand({ porte: "01", capitalSocial: 800_000 });
    expect(band?.confidence).toBe("baixa");
  });

  it("maps EPP and Demais to Lucro/Simples hints", () => {
    expect(estimateRevenueBand({ porte: "03" })?.bandId).toBe("360k_4_8m");
    expect(estimateRevenueBand({ porte: "05" })?.regimeHint).toMatch(/Lucro/i);
  });
});
