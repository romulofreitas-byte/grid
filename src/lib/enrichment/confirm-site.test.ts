import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichCompany, type CascadeCompany } from "./cascade";
import type { Company, Establishment } from "@/lib/types";

const CNPJ = "12345678000190";

function companyInput(): CascadeCompany {
  const establishment: Establishment = {
    cnpj: CNPJ,
    cnpj_basico: "12345678",
    is_matriz: true,
    nome_fantasia: "Clinica Sol",
    situacao: "02",
    data_situacao: null,
    data_inicio: null,
    cnae_principal: "8630503",
    cnae_secundarios: [],
    logradouro: "Rua A",
    numero: "1",
    complemento: null,
    bairro: null,
    cep: "30130100",
    uf: "MG",
    municipio_id: 1,
    ddd1: "31",
    telefone1: "33331111",
    ddd2: null,
    telefone2: null,
    email: null,
  };
  const company: Company = {
    cnpj_basico: "12345678",
    razao_social: "Clinica Sol Ltda",
    natureza_id: null,
    qualificacao_responsavel: null,
    capital_social: null,
    porte: "03",
  };
  return {
    establishment,
    company,
    municipioNome: "Belo Horizonte",
    sharedCount: 0,
    sharedVerdict: "proprio",
    scoreProfile: "b2c_local",
    qsaNomes: ["Maria Silva"],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.SERPER_API_KEY;
});

describe("human site confirm and reject", () => {
  it("keeps a rejected host out of the next search", async () => {
    const queries: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const href = String(input);
        if (href.includes("google.serper.dev/search")) {
          queries.push(String(init?.body ?? ""));
          return new Response(
            JSON.stringify({
              organic: [
                { link: "https://errado.test", title: "Outra" },
                { link: "https://clinicasol.com.br", title: "Clinica Sol BH" },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.includes("google.serper.dev/maps")) {
          return new Response(JSON.stringify({ places: [] }), { status: 200 });
        }
        if (href.endsWith("/robots.txt")) {
          return new Response("User-agent: *\nAllow: /\n", { status: 200 });
        }
        if (href.includes("clinicasol.com.br")) {
          return new Response(`<html><body>Clinica Sol CNPJ ${CNPJ}</body></html>`, {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );
    process.env.SERPER_API_KEY = "test";
    const { row } = await enrichCompany(companyInput(), null, undefined, {
      discardedDomains: ["errado.test"],
    });
    expect(row.domain).toBe("clinicasol.com.br");
    expect(row.discarded_domains).toContain("errado.test");
  });
});
