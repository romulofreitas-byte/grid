import { describe, expect, it, vi } from "vitest";
import {
  formatNichoCidade,
  resolveFichaNichoNome,
  resolveNichoNome,
} from "./nicho-cidade";

describe("formatNichoCidade", () => {
  it("joins nicho and cidade", () => {
    expect(formatNichoCidade("Papelaria", "João Pessoa")).toBe(
      "Papelaria · João Pessoa",
    );
  });

  it("shows whichever side exists", () => {
    expect(formatNichoCidade("Papelaria", "  ")).toBe("Papelaria");
    expect(formatNichoCidade(null, "João Pessoa")).toBe("João Pessoa");
    expect(formatNichoCidade(" ", null)).toBe("");
  });
});

describe("resolveNichoNome", () => {
  it("prefers the CRM pipeline over the search segment", () => {
    expect(
      resolveNichoNome({
        pipelineNome: "Papelaria",
        segmentNome: "Comércio",
      }),
    ).toBe("Papelaria");
  });

  it("falls back to the search segment", () => {
    expect(
      resolveNichoNome({
        pipelineNome: "  ",
        segmentNome: "Clínicas estética",
      }),
    ).toBe("Clínicas estética");
  });
});

describe("resolveFichaNichoNome", () => {
  it("returns the pipeline without loading a preset", async () => {
    const getPreset = vi.fn();
    await expect(
      resolveFichaNichoNome(getPreset, {
        pipelineNome: "Papelaria",
        segmentId: "seg-1",
      }),
    ).resolves.toBe("Papelaria");
    expect(getPreset).not.toHaveBeenCalled();
  });

  it("loads the search segment when there is no CRM pipeline", async () => {
    const getPreset = vi.fn(async () => ({ nome: "Clínicas estética" }));
    await expect(
      resolveFichaNichoNome(getPreset, {
        pipelineNome: null,
        segmentId: "seg-1",
      }),
    ).resolves.toBe("Clínicas estética");
    expect(getPreset).toHaveBeenCalledWith("seg-1");
  });

  it("returns null when neither pipeline nor segment exists", async () => {
    const getPreset = vi.fn();
    await expect(
      resolveFichaNichoNome(getPreset, {
        pipelineNome: null,
        segmentId: null,
      }),
    ).resolves.toBeNull();
    expect(getPreset).not.toHaveBeenCalled();
  });
});
