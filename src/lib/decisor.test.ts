import { describe, expect, it } from "vitest";
import { pickDecisor, resolveDecisor, toPartnerCards } from "./decisor";
import type { Partner, RefQualificacao } from "./types";

const refs: RefQualificacao[] = [
  { id: 49, descricao: "Sócio-Administrador" },
  { id: 22, descricao: "Sócio" },
  { id: 10, descricao: "Diretor" },
];

function partner(over: Partial<Partner> & Pick<Partner, "nome" | "qualificacao_id">): Partner {
  return {
    id: over.id ?? 1,
    cnpj_basico: over.cnpj_basico ?? "12345678",
    nome: over.nome,
    qualificacao_id: over.qualificacao_id,
    data_entrada: over.data_entrada ?? "2018-01-01",
    faixa_etaria: over.faixa_etaria ?? 5,
  };
}

describe("pickDecisor", () => {
  it("prefers a person over a higher-ranked holding", () => {
    const picked = pickDecisor(
      [
        partner({
          id: 1,
          nome: "ALPHA HOLDING PARTICIPACOES LTDA",
          qualificacao_id: 49,
          faixa_etaria: 0,
          data_entrada: "2010-01-01",
        }),
        partner({
          id: 2,
          nome: "Maria Silva",
          qualificacao_id: 22,
          faixa_etaria: 5,
          data_entrada: "2020-01-01",
        }),
      ],
      refs,
    );
    expect(picked?.nome).toBe("Maria Silva");
  });

  it("falls back to the ranked PJ when there is no person", () => {
    const picked = pickDecisor(
      [
        partner({
          nome: "BETA COMERCIO LTDA",
          qualificacao_id: 22,
          faixa_etaria: 0,
        }),
        partner({
          id: 2,
          nome: "ALPHA HOLDING PARTICIPACOES LTDA",
          qualificacao_id: 49,
          faixa_etaria: 0,
        }),
      ],
      refs,
    );
    expect(picked?.nome).toBe("ALPHA HOLDING PARTICIPACOES LTDA");
  });

  it("still ranks people by qualification then entry date", () => {
    const picked = pickDecisor(
      [
        partner({
          nome: "João Sócio",
          qualificacao_id: 22,
          data_entrada: "2010-01-01",
        }),
        partner({
          id: 2,
          nome: "Ana Admin",
          qualificacao_id: 49,
          data_entrada: "2019-01-01",
        }),
      ],
      refs,
    );
    expect(picked?.nome).toBe("Ana Admin");
  });
});

describe("toPartnerCards", () => {
  it("classifies and labels holding vs person", () => {
    const cards = toPartnerCards(
      [
        partner({
          nome: "ALPHA HOLDING PARTICIPACOES LTDA",
          qualificacao_id: 49,
          faixa_etaria: 0,
        }),
        partner({
          id: 2,
          nome: "Maria Silva",
          qualificacao_id: 22,
        }),
      ],
      refs,
    );
    expect(cards[0]).toMatchObject({
      nome: "ALPHA HOLDING PARTICIPACOES LTDA",
      kind: "holding",
      kindLabel: "Holding",
      qualificacao: "Sócio-Administrador",
    });
    expect(cards[1]).toMatchObject({
      nome: "Maria Silva",
      kind: "pessoa",
      kindLabel: null,
      qualificacao: "Sócio",
    });
  });

  it("adds a synthetic Titular card from razão when QSA is empty", () => {
    const cards = toPartnerCards([], refs, {
      razaoSocial: "HANNA FABIELLY DOS SANTOS HOLANDA 02248911203",
      naturezaId: 2135,
    });
    expect(cards).toEqual([
      {
        nome: "HANNA FABIELLY DOS SANTOS HOLANDA",
        qualificacao: "Titular",
        dataEntrada: null,
        faixaEtaria: null,
        kind: "pessoa",
        kindLabel: null,
      },
    ]);
  });

  it("does not synthesize a card when QSA already has partners", () => {
    const cards = toPartnerCards(
      [partner({ nome: "Maria Silva", qualificacao_id: 22 })],
      refs,
      {
        razaoSocial: "JOSE CESAR DE SOUZA NETO 01690595299",
        naturezaId: 2135,
      },
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]?.nome).toBe("Maria Silva");
  });
});

describe("resolveDecisor", () => {
  it("keeps the QSA partner when the quadro is not empty", () => {
    const picked = resolveDecisor(
      [partner({ nome: "Maria Silva", qualificacao_id: 22 })],
      refs,
      {
        razaoSocial: "JOSE CESAR DE SOUZA NETO 01690595299",
        naturezaId: 2135,
      },
    );
    expect(picked).toMatchObject({
      nome: "Maria Silva",
      qualificacao: "Sócio",
    });
  });

  it("falls back to the stripped razão for empty QSA + EI", () => {
    const picked = resolveDecisor([], refs, {
      razaoSocial: "38.453.434 JOSE THEIMY FERNANDES MACEDO",
      naturezaId: 2135,
    });
    expect(picked).toMatchObject({
      nome: "JOSE THEIMY FERNANDES MACEDO",
      qualificacao: "Titular",
      dataEntrada: null,
      faixaEtaria: null,
    });
    expect(picked?.nome).not.toMatch(/\d/);
  });

  it("does not fill 2062 without a document pattern", () => {
    expect(
      resolveDecisor([], refs, {
        razaoSocial: "CONSTRUTORA DEUS E FIEL",
        naturezaId: 2062,
      }),
    ).toBeNull();
  });

  it("fills 2062 when the razão embeds a person name and a document", () => {
    expect(
      resolveDecisor([], refs, {
        razaoSocial: "41.931.380 WALLASON MOREIRA BENEVIDES",
        naturezaId: 2062,
      })?.nome,
    ).toBe("WALLASON MOREIRA BENEVIDES");
  });
});
