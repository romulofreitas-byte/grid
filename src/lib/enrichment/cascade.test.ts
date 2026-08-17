import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichCompany, type CascadeCompany } from "./cascade";
import { OSM_OVERPASS_URL } from "./osm";
import type { Company, Establishment } from "@/lib/types";

const CNPJ = "12345678000190";

function companyInput(domain: string): CascadeCompany {
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
    email: `contato@${domain}`,
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

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html" },
  });
}

function mockSiteFetch(pages: Record<string, string>) {
  const requested: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const href = String(input);
      requested.push(href);
      if (href.endsWith("/robots.txt")) {
        return new Response("User-agent: *\nAllow: /\n", { status: 200 });
      }
      if (href.startsWith(OSM_OVERPASS_URL)) {
        return new Response(JSON.stringify({ elements: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const url = new URL(href);
      const path = url.pathname === "" ? "/" : url.pathname;
      const html = pages[path];
      if (html == null) return htmlResponse("not found", 404);
      return htmlResponse(html);
    }),
  );
  return requested;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("enrichCompany crawl", () => {
  it("stops after the home page when the domain is already confirmed", async () => {
    const domain = "sol-home.test";
    const requested = mockSiteFetch({
      "/": `<html><body>Clinica Sol CNPJ ${CNPJ}</body></html>`,
      "/quem-somos": "<html><body>equipe</body></html>",
    });

    const { row, timings } = await enrichCompany(companyInput(domain));

    expect(row.domain_status).toBe("confirmado");
    expect(timings.pages).toBe(1);
    expect(timings.osm_ms).toBe(0);
    expect(row.osm).toBeNull();
    const sitePaths = requested
      .filter((u) => u.includes(domain) && !u.endsWith("/robots.txt"))
      .map((u) => new URL(u).pathname);
    expect(sitePaths).toEqual(["/"]);
    expect(requested.some((u) => u.startsWith(OSM_OVERPASS_URL))).toBe(false);
  });

  it("keeps crawling until an inner page confirms, then stops", async () => {
    const domain = "sol-inner.test";
    const requested = mockSiteFetch({
      "/": "<html><body>Bem-vindo</body></html>",
      "/quem-somos": `<html><body>Clinica Sol CNPJ ${CNPJ}</body></html>`,
      "/equipe": "<html><body>time</body></html>",
    });

    const { row, timings } = await enrichCompany(companyInput(domain));

    expect(row.domain_status).toBe("confirmado");
    expect(timings.pages).toBe(2);
    const sitePaths = requested
      .filter((u) => u.includes(domain) && !u.endsWith("/robots.txt"))
      .map((u) => new URL(u).pathname);
    expect(sitePaths).toEqual(["/", "/quem-somos"]);
  });
});
