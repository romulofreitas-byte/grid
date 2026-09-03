import { describe, expect, it } from "vitest";
import { mockRepo } from "./mock-repo";
import { getMockStore } from "./mock-store";

describe("getDossier approach doors", () => {
  it("exposes classified socios and prefers a person over the holding", async () => {
    const store = getMockStore();
    const holding = store.partners.find((p) =>
      p.nome.includes("ALPHA HOLDING"),
    );
    expect(holding).toBeTruthy();
    const est = store.establishments.find(
      (e) => e.cnpj_basico === holding!.cnpj_basico,
    );
    expect(est).toBeTruthy();

    const dossier = await mockRepo.getDossier(est!.cnpj);
    expect(dossier).toBeTruthy();
    expect(dossier!.socios.some((s) => s.kind === "holding")).toBe(true);
    expect(dossier!.decisor?.nome).not.toMatch(/HOLDING/i);
    expect(dossier!.decisor?.nome).toBeTruthy();

    const others = dossier!.socios.filter(
      (s) => s.nome !== dossier!.decisor?.nome,
    );
    expect(others.some((s) => s.kindLabel === "Holding")).toBe(true);
  });

  it("includes recommended site people on the seeded enrichment", async () => {
    const store = getMockStore();
    const est = store.establishments[0]!;
    const dossier = await mockRepo.getDossier(est.cnpj);
    expect(dossier?.enrichment?.people?.length).toBeGreaterThanOrEqual(2);
    expect(
      dossier?.enrichment?.people?.some(
        (p) => p.portaRecomendada && p.papel === "vendas",
      ),
    ).toBe(true);
    expect(
      dossier?.enrichment?.people?.some(
        (p) => p.portaRecomendada && p.papel === "financeiro",
      ),
    ).toBe(true);
  });

  it("fills decisor from razão social when QSA is empty for EI", async () => {
    const store = getMockStore();
    const est = store.establishments[0]!;
    const company = store.companies.find((c) => c.cnpj_basico === est.cnpj_basico)!;
    const previousRazao = company.razao_social;
    const previousNatureza = company.natureza_id;
    const removed = store.partners.filter((p) => p.cnpj_basico === est.cnpj_basico);
    store.partners = store.partners.filter((p) => p.cnpj_basico !== est.cnpj_basico);
    company.razao_social = "HANNA FABIELLY DOS SANTOS HOLANDA 02248911203";
    company.natureza_id = 2135;
    try {
      const dossier = await mockRepo.getDossier(est.cnpj);
      expect(dossier?.decisor).toMatchObject({
        nome: "HANNA FABIELLY DOS SANTOS HOLANDA",
        qualificacao: "Titular",
      });
      expect(dossier?.socios).toEqual([
        expect.objectContaining({
          nome: "HANNA FABIELLY DOS SANTOS HOLANDA",
          qualificacao: "Titular",
          kind: "pessoa",
        }),
      ]);
    } finally {
      company.razao_social = previousRazao;
      company.natureza_id = previousNatureza;
      store.partners.push(...removed);
    }
  });

  it("labels gestão as empresa de gestão", async () => {
    const store = getMockStore();
    const gestao = store.partners.find((p) => p.nome.includes("GESTAO"));
    expect(gestao).toBeTruthy();
    const est = store.establishments.find(
      (e) => e.cnpj_basico === gestao!.cnpj_basico,
    );
    const dossier = await mockRepo.getDossier(est!.cnpj);
    expect(dossier!.socios.some((s) => s.kind === "gestao")).toBe(true);
  });
});
