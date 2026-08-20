import { describe, expect, it } from "vitest";
import { mockRepo } from "./mock-repo";
import { MUNICIPIO_MULTI_UF_CAP } from "@/lib/municipios";

describe("mockRepo.listMunicipios", () => {
  it("returns every city in one UF, including letters past B", async () => {
    const all = await mockRepo.listMunicipios(["MG"]);
    expect(all.length).toBeGreaterThan(MUNICIPIO_MULTI_UF_CAP);
    expect(all.some((m) => m.nome.startsWith("D"))).toBe(true);
  });

  it("filters from one character", async () => {
    const hits = await mockRepo.listMunicipios(["MG"], "D");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((m) => m.nome.toLowerCase().includes("d"))).toBe(true);
  });
});
