import { describe, expect, it } from "vitest";
import {
  deriveSeal,
  emailDomainCorrelatesWithBrand,
  isFreeEmail,
  receitaProviderDomain,
  verdictFromPartnerOverlap,
} from "./contact-confidence";
import { normalizePhoneBR } from "./phone";

const receita = normalizePhoneBR("3133334444")!;
const siteSame = normalizePhoneBR("(31) 3333-4444")!;
const siteOther = normalizePhoneBR("31988887777")!;

describe("deriveSeal", () => {
  it("CONFIRMADO when domain is confirmed and Receita number is on the site", () => {
    const r = deriveSeal({
      domainStatus: "confirmado",
      receita,
      sitePhones: [siteSame],
      sharedCount: 1,
      sharedVerdict: "proprio",
    });
    expect(r.seal).toBe("CONFIRMADO");
  });

  it("CONFIRMADO wins over Contabilidade when the company publishes the shared number", () => {
    const r = deriveSeal({
      domainStatus: "confirmado",
      receita,
      sitePhones: [siteSame],
      sharedCount: 47,
      sharedVerdict: "contabilidade",
    });
    expect(r.seal).toBe("CONFIRMADO");
    expect(r.sideNote).toMatch(/47 empresas/);
  });

  it("ATUALIZADO when confirmed site has a different number", () => {
    const r = deriveSeal({
      domainStatus: "confirmado",
      receita,
      sitePhones: [siteOther],
      sharedCount: 1,
      sharedVerdict: "proprio",
    });
    expect(r.seal).toBe("ATUALIZADO");
    expect(r.principalIsSite).toBe(true);
  });

  it("does not CONFIRMADO when domain is not confirmed", () => {
    const r = deriveSeal({
      domainStatus: "nao_confirmado",
      receita,
      sitePhones: [siteSame],
      sharedCount: 1,
      sharedVerdict: "proprio",
    });
    expect(r.seal).toBe("NAO_CONFIRMADO");
  });

  it("CONTABILIDADE when shared and owners differ", () => {
    const r = deriveSeal({
      domainStatus: "nao_encontrado",
      receita,
      sitePhones: [],
      sharedCount: 12,
      sharedVerdict: "contabilidade",
    });
    expect(r.seal).toBe("COMPARTILHADO");
  });

  it("GRUPO when shared and partners overlap", () => {
    const r = deriveSeal({
      domainStatus: "nao_encontrado",
      receita,
      sitePhones: [],
      sharedCount: 6,
      sharedVerdict: "grupo_economico",
    });
    expect(r.seal).toBe("GRUPO");
  });

  it("never keeps GRUPO when the number is on more than 50 companies", () => {
    const r = deriveSeal({
      domainStatus: "nao_encontrado",
      receita,
      sitePhones: [],
      sharedCount: 51,
      sharedVerdict: "grupo_economico",
    });
    expect(r.seal).toBe("COMPARTILHADO");
  });
});

describe("verdictFromPartnerOverlap", () => {
  it("marks a small cluster with strong partner overlap as grupo_economico", () => {
    const map = new Map<string, string[]>([
      ["11111111", ["Helena Vargas Silva"]],
      ["22222222", ["Helena Vargas Silva"]],
      ["33333333", ["Helena Vargas Silva"]],
      ["44444444", ["Helena Vargas Silva"]],
      ["55555555", ["Outro Socio"]],
    ]);
    expect(verdictFromPartnerOverlap(5, map)).toBe("grupo_economico");
  });

  it("does not call two shared names in three CNPJs a group", () => {
    const map = new Map<string, string[]>([
      ["11111111", ["Helena Vargas Silva", "Outro"]],
      ["22222222", ["Helena Vargas Silva"]],
      ["33333333", ["Terceiro Nome"]],
    ]);
    expect(verdictFromPartnerOverlap(3, map)).toBe("contabilidade");
  });

  it("marks disjoint partners as contabilidade", () => {
    const map = new Map<string, string[]>([
      ["11111111", ["Ana Paula Souza"]],
      ["22222222", ["Carlos Eduardo Lima"]],
      ["33333333", ["Fernanda Ribeiro"]],
    ]);
    expect(verdictFromPartnerOverlap(3, map)).toBe("contabilidade");
  });

  it("is proprio below the threshold", () => {
    const map = new Map<string, string[]>([["11111111", ["Ana"]]]);
    expect(verdictFromPartnerOverlap(1, map)).toBe("proprio");
  });

  it("treats huge clusters as accounting even with a name collision", () => {
    const map = new Map<string, string[]>();
    for (let i = 0; i < 335; i++) {
      const id = String(i).padStart(8, "0");
      map.set(id, i < 2 ? ["Jose Da Silva"] : [`Socio ${i}`]);
    }
    expect(verdictFromPartnerOverlap(335, map)).toBe("contabilidade");
  });

  it("treats every cluster above 50 as accounting", () => {
    const map = new Map<string, string[]>();
    for (let i = 0; i < 51; i++) {
      map.set(String(i).padStart(8, "0"), ["Mesmo Socio"]);
    }
    expect(verdictFromPartnerOverlap(51, map)).toBe("contabilidade");
  });

  it("rejects weak overlap inside a medium cluster", () => {
    const map = new Map<string, string[]>([
      ["11111111", ["Helena Vargas Silva"]],
      ["22222222", ["Helena Vargas Silva"]],
      ["33333333", ["Helena Vargas Silva"]],
      ["44444444", ["A"]],
      ["55555555", ["B"]],
      ["66666666", ["C"]],
      ["77777777", ["D"]],
      ["88888888", ["E"]],
      ["99999999", ["F"]],
      ["10101010", ["G"]],
    ]);
    expect(verdictFromPartnerOverlap(10, map)).toBe("contabilidade");
  });
});

describe("isFreeEmail / emailDomainCorrelatesWithBrand", () => {
  it("treats uai.com.br as a free/portal mailbox", () => {
    expect(isFreeEmail("serconsjn@uai.com.br")).toBe(true);
  });

  it("rejects email hosts that do not carry the brand", () => {
    expect(
      emailDomainCorrelatesWithBrand(
        "serconsjn@empresaxyz.com.br",
        "AUTO PECAS STELA LTDA",
        "AUTO PECAS SAO LUIZ",
        "Descoberto",
      ),
    ).toBe(false);
  });

  it("accepts corporate hosts that embed a strong brand token", () => {
    expect(
      emailDomainCorrelatesWithBrand(
        "contato@colegiogenesis.com.br",
        "Genesis Sociedade de Ensino Ltda",
        "Genesis",
        "Belo Horizonte",
      ),
    ).toBe(true);
  });
});

describe("receitaProviderDomain", () => {
  it("returns host when e-mail is shared (accountant without contab in name)", () => {
    expect(
      receitaProviderDomain("processos@contajul.com", { shared: true }),
    ).toBe("contajul.com");
  });

  it("returns host for accountant keyword hints without shared flag", () => {
    expect(
      receitaProviderDomain("contato@assessoriacontabil.com.br"),
    ).toBe("assessoriacontabil.com.br");
  });

  it("ignores free mailbox hosts even when shared", () => {
    expect(
      receitaProviderDomain("loja@gmail.com", { shared: true }),
    ).toBeNull();
  });

  it("ignores unique corporate e-mail without provider flags", () => {
    expect(
      receitaProviderDomain("contato@tnaslubrificacao.com.br"),
    ).toBeNull();
  });
});
