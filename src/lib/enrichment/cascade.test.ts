import { afterEach, describe, expect, it, vi } from "vitest";
import { domainFromEmail, enrichCompany, type CascadeCompany } from "./cascade";
import { OSM_OVERPASS_URL } from "./osm";
import type { Company, Establishment } from "@/lib/types";

const CNPJ = "12345678000190";

function companyInput(domain: string): CascadeCompany {
  const establishment: Establishment = {
    cnpj: CNPJ,
    cnpj_basico: "12345678",
    is_matriz: true,
    nome_fantasia: "Solaris",
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
    razao_social: "Solaris Clinica Ltda",
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
      if (href.includes("google.serper.dev/maps")) {
        return new Response(JSON.stringify({ places: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (href.includes("google.serper.dev/search")) {
        return new Response(JSON.stringify({ organic: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const url = new URL(href);
      const path = url.pathname === "" ? "/" : url.pathname;
      const body = pages[path];
      if (body == null) return htmlResponse("not found", 404);
      if (path.endsWith(".js")) {
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/javascript" },
        });
      }
      return htmlResponse(body);
    }),
  );
  return requested;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("domainFromEmail", () => {
  it("never seeds a portal mailbox like uai.com.br", () => {
    expect(
      domainFromEmail("serconsjn@uai.com.br", {
        razaoSocial: "AUTO PECAS STELA LTDA",
        nomeFantasia: "AUTO PECAS SAO LUIZ",
        municipio: "Descoberto",
      }),
    ).toBeNull();
  });

  it("never seeds a shared email even on a branded host", () => {
    expect(
      domainFromEmail("contato@colegiogenesis.com.br", {
        razaoSocial: "Genesis Sociedade de Ensino Ltda",
        nomeFantasia: "Genesis",
        municipio: "Belo Horizonte",
        emailShared: true,
      }),
    ).toBeNull();
  });

  it("seeds only when the host embeds a strong brand token", () => {
    expect(
      domainFromEmail("contato@colegiogenesis.com.br", {
        razaoSocial: "Genesis Sociedade de Ensino Ltda",
        nomeFantasia: "Genesis",
        municipio: "Belo Horizonte",
      }),
    ).toBe("colegiogenesis.com.br");
  });

  it("seeds Érica Rúbia and Grupo Atos from the Receita e-mail host", () => {
    expect(
      domainFromEmail("contato@ericarubia.com.br", {
        razaoSocial: "ERICA RUBIA SAUDE ESTETICA LTDA",
        nomeFantasia: "ERICA RUBIA CLINICA DE ESTETICA",
        municipio: "Belo Horizonte",
      }),
    ).toBe("ericarubia.com.br");
    expect(
      domainFromEmail("marcosbreno@grupoatos.com", {
        razaoSocial: "GRUPO ATOS LTDA",
        nomeFantasia: "GRUPO ATOS",
        municipio: "Belo Horizonte",
      }),
    ).toBe("grupoatos.com");
  });
});

describe("enrichCompany crawl", () => {
  it("stops ownership after home confirms, then harvests contact paths", async () => {
    const domain = "sol-home.test";
    const requested = mockSiteFetch({
      "/": `<html><body>Solaris CNPJ ${CNPJ}</body></html>`,
      "/quem-somos": "<html><body>equipe</body></html>",
      "/contato": "<html><body>fale conosco</body></html>",
    });

    const { row, timings } = await enrichCompany(companyInput(domain), {
      domain,
      status: "nao_confirmado",
    });

    expect(row.domain_status).toBe("confirmado");
    expect(timings.osm_ms).toBe(0);
    expect(row.osm).toBeNull();
    const sitePaths = requested
      .filter((u) => u.includes(domain) && !u.endsWith("/robots.txt"))
      .map((u) => new URL(u).pathname);
    expect(sitePaths[0]).toBe("/");
    expect(sitePaths).toContain("/contato");
    expect(sitePaths).not.toContain("/equipe");
    expect(requested.some((u) => u.startsWith(OSM_OVERPASS_URL))).toBe(false);
  });

  it("keeps crawling ownership until an inner page confirms, then harvests", async () => {
    const domain = "sol-inner.test";
    const requested = mockSiteFetch({
      "/": "<html><body>Bem-vindo</body></html>",
      "/quem-somos": `<html><body>Solaris CNPJ ${CNPJ}</body></html>`,
      "/equipe": "<html><body>time</body></html>",
      "/contato": "<html><body>contato</body></html>",
    });

    const { row } = await enrichCompany(companyInput(domain), {
      domain,
      status: "nao_confirmado",
    });

    expect(row.domain_status).toBe("confirmado");
    const sitePaths = requested
      .filter((u) => u.includes(domain) && !u.endsWith("/robots.txt"))
      .map((u) => new URL(u).pathname);
    expect(sitePaths.slice(0, 2)).toEqual(["/", "/quem-somos"]);
    expect(sitePaths).toContain("/contato");
    expect(sitePaths).not.toContain("/equipe");
  });

  it("after force-confirm, harvests /contato and extracts Instagram", async () => {
    const domain = "genesis-school.test";
    mockSiteFetch({
      "/": "<html><body><h1>Bem-vindo</h1></body></html>",
      "/contato": `<html><body>
        <a href="https://www.instagram.com/colegiogenesis/">Instagram</a>
      </body></html>`,
    });
    const input = companyInput(domain);
    input.establishment.nome_fantasia = "Genesis";
    input.company.razao_social = "Genesis Sociedade de Ensino Ltda";

    const { row } = await enrichCompany(input, null, undefined, {
      forceConfirmDomain: domain,
    });

    expect(row.domain_status).toBe("confirmado");
    expect(row.socials.instagram).toBe("https://instagram.com/colegiogenesis");
    expect(row.fonte.instagram?.fonte).toBe("site");
  });

  it("harvests WhatsApp and Instagram from SPA JS when HTML shell is empty", async () => {
    const domain = "spa-wa.test";
    const requested = mockSiteFetch({
      "/": `<!doctype html><html><head><title>Solaris CNPJ ${CNPJ}</title></head>
        <body><div id="root"></div>
        <script src="/assets/index-abc.js"></script>
        <script src="/whatsapp-click.js"></script>
        </body></html>`,
      "/contato": "<html><body></body></html>",
      "/assets/index-abc.js":
        'const wa="https://wa.me/553199275701?text=oi";const ig="https://instagram.com/solaris_oficial";',
      "/whatsapp-click.js": 'window.open("https://wa.me/553133891808")',
    });

    const { row } = await enrichCompany(companyInput(domain), {
      domain,
      status: "nao_confirmado",
    });

    expect(row.domain_status).toBe("confirmado");
    expect(row.whatsapp).toBe("553199275701");
    expect(row.socials.instagram).toBe("https://instagram.com/solaris_oficial");
    expect(requested.some((u) => u.includes("/assets/index-abc.js"))).toBe(true);
  });

  it("does not accept Serper Instagram for weak brands without a confirmed site", async () => {
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        if (href.includes("google.serper.dev/search")) {
          return new Response(
            JSON.stringify({
              organic: [
                {
                  link: "https://www.instagram.com/sagem/",
                  title: "Sage Michaels (@sagem)",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.includes("google.serper.dev/maps")) {
          return new Response(JSON.stringify({ places: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("unused.test");
    input.establishment.email = null;
    input.establishment.nome_fantasia = "DISTRIBUIDORA SILVA";
    input.company.razao_social =
      "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA";
    input.municipioNome = "Contagem";

    const { row } = await enrichCompany(input);
    expect(row.domain_status).toBe("nao_encontrado");
    expect(row.socials.instagram).toBeUndefined();
    expect(row.fonte.instagram?.fonte).toBe("skipped_weak_brand");
    delete process.env.SERPER_API_KEY;
  });

  it("searches Instagram for a weak brand when Maps phone matches Receita", async () => {
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        if (href.includes("google.serper.dev/maps")) {
          return new Response(
            JSON.stringify({
              places: [
                {
                  title: "Padaria do Centro",
                  website: "https://padaria-centro.com.br",
                },
                {
                  title: "Loja do Bairro",
                  phoneNumber: "(31) 3333-1111",
                  website: "https://silva-maps.test",
                  address: "Rua das Palmeiras, 100 - Contagem - MG",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.includes("google.serper.dev/search")) {
          return new Response(
            JSON.stringify({
              organic: [
                {
                  link: "https://www.instagram.com/distribuidorasilvacontagem/",
                  title: "Distribuidora Silva Contagem",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.endsWith("/robots.txt")) {
          return new Response("User-agent: *\nAllow: /\n", { status: 200 });
        }
        if (href.includes("silva-maps.test")) {
          return htmlResponse("<html><body>Peças automotivas</body></html>");
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("unused.test");
    input.establishment.email = null;
    input.establishment.nome_fantasia = "DISTRIBUIDORA SILVA";
    input.company.razao_social =
      "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA";
    input.municipioNome = "Contagem";
    input.establishment.uf = "MG";
    input.establishment.logradouro = "Rua das Palmeiras";
    input.establishment.numero = "100";
    input.establishment.ddd1 = "31";
    input.establishment.telefone1 = "33331111";

    const { row } = await enrichCompany(input);
    expect(row.gmb?.matched).toBe(true);
    expect(row.gmb?.match_by).toEqual(expect.arrayContaining(["phone"]));
    expect(row.socials.instagram).toContain("distribuidorasilvacontagem");
    expect(row.fonte.instagram?.fonte).toBe("serper");
    expect(row.fonte.instagram?.fonte).not.toBe("skipped_weak_brand");
    delete process.env.SERPER_API_KEY;
  });

  it("issues a web Instagram query when GMB is corroborated and site: misses", async () => {
    process.env.SERPER_API_KEY = "test";
    const searchBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const href = String(input);
        if (href.includes("google.serper.dev/maps")) {
          return new Response(
            JSON.stringify({
              places: [
                {
                  title: "Loja do Bairro",
                  phoneNumber: "(31) 3333-1111",
                  cid: "123",
                  address: "Rua das Palmeiras, 100 - Contagem - MG",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.includes("google.serper.dev/search")) {
          const body = String(init?.body ?? "");
          searchBodies.push(body);
          if (
            body.includes("Instagram") &&
            !body.includes("site:instagram.com")
          ) {
            return new Response(
              JSON.stringify({
                organic: [
                  {
                    link: "https://www.instagram.com/distribuidorasilvacontagem/",
                    title: "Distribuidora Silva Contagem",
                  },
                ],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
          return new Response(JSON.stringify({ organic: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("unused.test");
    input.establishment.email = null;
    input.establishment.nome_fantasia = "DISTRIBUIDORA SILVA";
    input.company.razao_social =
      "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA";
    input.municipioNome = "Contagem";
    input.establishment.logradouro = "Rua das Palmeiras";
    input.establishment.numero = "100";
    input.establishment.ddd1 = "31";
    input.establishment.telefone1 = "33331111";

    const { row } = await enrichCompany(input);
    expect(row.gmb?.matched).toBe(true);
    expect(row.socials.instagram).toContain("distribuidorasilvacontagem");
    expect(
      searchBodies.some(
        (body) =>
          body.includes("Instagram") && !body.includes("site:instagram.com"),
      ),
    ).toBe(true);
    delete process.env.SERPER_API_KEY;
  });

  it("accepts Serper Instagram without site when brand token is strong", async () => {
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        if (href.includes("google.serper.dev/search")) {
          return new Response(
            JSON.stringify({
              organic: [
                {
                  link: "https://www.instagram.com/colegiogenesis/",
                  title: "Colégio Genesis (@colegiogenesis) • Instagram",
                },
                {
                  link: "https://www.instagram.com/sagem/",
                  title: "Sage Michaels (@sagem)",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.includes("google.serper.dev/maps")) {
          return new Response(JSON.stringify({ places: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("unused.test");
    input.establishment.email = null;
    input.establishment.nome_fantasia = "Genesis";
    input.company.razao_social = "Genesis Sociedade de Ensino Ltda";
    input.municipioNome = "Belo Horizonte";

    const { row } = await enrichCompany(input);
    expect(row.domain_status).toBe("nao_encontrado");
    expect(row.socials.instagram).toBe("https://www.instagram.com/colegiogenesis/");
    expect(row.fonte.instagram?.fonte).toBe("serper");
    delete process.env.SERPER_API_KEY;
  });

  it("confirms a human-approved domain even when the page does not mention the company", async () => {
    const domain = "sol-down.test";
    mockSiteFetch({
      "/": "<html><body>Página genérica</body></html>",
    });
    const { row } = await enrichCompany(companyInput(domain), null, undefined, {
      forceConfirmDomain: domain,
    });
    expect(row.domain_status).toBe("confirmado");
    expect(row.domain).toBe(domain);
    expect(row.fonte.domain?.fonte).toBe("human");
  });

  it("confirms a human-approved domain even when the page returns 403", async () => {
    const domain = "bloqueado.test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        if (href.endsWith("/robots.txt")) {
          return new Response("User-agent: *\nAllow: /\n", { status: 200 });
        }
        if (href.startsWith(OSM_OVERPASS_URL)) {
          return new Response(JSON.stringify({ elements: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (href.includes("google.serper.dev/maps")) {
          return new Response(JSON.stringify({ places: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (href.includes("google.serper.dev/search")) {
          return new Response(JSON.stringify({ organic: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (href.includes(domain)) {
          return htmlResponse("Forbidden", 403);
        }
        return htmlResponse("not found", 404);
      }),
    );
    const { row } = await enrichCompany(companyInput(domain), null, undefined, {
      forceConfirmDomain: domain,
    });
    expect(row.domain_status).toBe("confirmado");
    expect(row.domain).toBe(domain);
    expect(row.http_status).toBe(403);
  });

  it("skips a discarded cached domain and searches with the fantasy name", async () => {
    const serperBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const href = String(input);
        if (href.includes("google.serper.dev/search")) {
          serperBodies.push(String(init?.body ?? ""));
          return new Response(
            JSON.stringify({
              organic: [
                {
                  link: "https://portal-gen.com.br/lista",
                  title: "Empresas de BH",
                  snippet: "Lista",
                },
                {
                  link: "https://solarishbh.com.br",
                  title: "Solaris Belo Horizonte",
                  snippet: "Clínica em Belo Horizonte",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.includes("google.serper.dev/maps")) {
          return new Response(JSON.stringify({ places: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (href.endsWith("/robots.txt")) {
          return new Response("User-agent: *\nAllow: /\n", { status: 200 });
        }
        if (href.includes("solarishbh.com.br")) {
          return htmlResponse(`<html><body>Solaris CNPJ ${CNPJ}</body></html>`);
        }
        return htmlResponse("not found", 404);
      }),
    );
    process.env.SERPER_API_KEY = "test";
    const input = companyInput("descartado.test");
    input.establishment.email = null;
    const { row } = await enrichCompany(
      input,
      { domain: "descartado.test", status: "nao_confirmado" },
      undefined,
      { discardedDomains: ["descartado.test"] },
    );
    expect(serperBodies.some((body) => body.includes("Solaris"))).toBe(true);
    expect(row.domain).toBe("solarishbh.com.br");
    delete process.env.SERPER_API_KEY;
  });

  it("uses matched GMB website as domain seed when organic search misses", async () => {
    process.env.SERPER_API_KEY = "test";
    const order: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        if (href.includes("google.serper.dev/maps")) {
          order.push("maps");
          return new Response(
            JSON.stringify({
              places: [
                {
                  title: "Solaris Belo Horizonte",
                  website: "https://www.solaris-gmb.com.br",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.includes("google.serper.dev/search")) {
          order.push("search");
          return new Response(JSON.stringify({ organic: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (href.endsWith("/robots.txt")) {
          return new Response("User-agent: *\nAllow: /\n", { status: 200 });
        }
        if (href.includes("solaris-gmb.com.br")) {
          return htmlResponse(`<html><body>Solaris CNPJ ${CNPJ}</body></html>`);
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("unused.test");
    input.establishment.email = null;
    const { row } = await enrichCompany(input);
    expect(order[0]).toBe("search");
    expect(order).toContain("maps");
    expect(order.indexOf("maps")).toBeGreaterThan(order.indexOf("search"));
    expect(row.domain).toBe("solaris-gmb.com.br");
    expect(row.fonte.domain?.fonte).toBe("gmb");
    expect(row.domain_status).toBe("confirmado");
    delete process.env.SERPER_API_KEY;
  });

  it("prefers an organic brand hit over a GMB website", async () => {
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        if (href.includes("google.serper.dev/maps")) {
          return new Response(
            JSON.stringify({
              places: [
                {
                  title: "Solaris Belo Horizonte",
                  website: "https://www.solaris-gmb.com.br",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.includes("google.serper.dev/search")) {
          return new Response(
            JSON.stringify({
              organic: [
                {
                  link: "https://solaris-web.com.br",
                  title: "Solaris Belo Horizonte",
                  snippet: "Clínica Solaris",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.endsWith("/robots.txt")) {
          return new Response("User-agent: *\nAllow: /\n", { status: 200 });
        }
        if (href.includes("solaris-web.com.br")) {
          return htmlResponse(`<html><body>Solaris CNPJ ${CNPJ}</body></html>`);
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("unused.test");
    input.establishment.email = null;
    const { row } = await enrichCompany(input);
    expect(row.domain).toBe("solaris-web.com.br");
    expect(row.fonte.domain?.fonte).toBe("serper");
    delete process.env.SERPER_API_KEY;
  });

  it("seeds the site from a correlated e-mail and does not take a neighbor GMB listing", async () => {
    process.env.SERPER_API_KEY = "test";
    const requested: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        requested.push(href);
        if (href.includes("google.serper.dev/maps")) {
          return new Response(
            JSON.stringify({
              places: [
                {
                  title: "Floricultura Via das Flores",
                  address: "Rua da Bahia, 2741 - Belo Horizonte - MG",
                  website: "https://viadasflores.com.br",
                  cid: "999",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.includes("google.serper.dev/search")) {
          return new Response(JSON.stringify({ organic: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (href.endsWith("/robots.txt")) {
          return new Response("User-agent: *\nAllow: /\n", { status: 200 });
        }
        if (href.includes("grupoatos.com")) {
          return htmlResponse(
            "<html><body>Grupo Atos CNPJ 12072240000180</body></html>",
          );
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("grupoatos.com");
    input.establishment.email = "marcosbreno@grupoatos.com";
    input.establishment.nome_fantasia = "GRUPO ATOS";
    input.company.razao_social = "GRUPO ATOS LTDA";
    input.establishment.logradouro = "Rua da Bahia";
    input.establishment.numero = "2741";
    input.establishment.cnpj = "12072240000180";
    const { row } = await enrichCompany(input);
    expect(row.domain).toBe("grupoatos.com");
    expect(row.fonte.domain?.fonte).toBe("email_receita");
    expect(row.gmb?.matched).toBe(false);
    const firstMaps = requested.findIndex((u) =>
      u.includes("google.serper.dev/maps"),
    );
    const firstSite = requested.findIndex((u) => u.includes("grupoatos.com"));
    expect(firstSite).toBeGreaterThanOrEqual(0);
    if (firstMaps >= 0) {
      expect(firstMaps).toBeGreaterThan(firstSite);
    }
    delete process.env.SERPER_API_KEY;
  });

  it("treats shared Receita e-mail host as absent — never candidate or social", async () => {
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        if (href.includes("google.serper.dev/maps")) {
          return new Response(JSON.stringify({ places: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (href.includes("google.serper.dev/search")) {
          return new Response(
            JSON.stringify({
              organic: [
                {
                  link: "https://contajul.com/",
                  title: "Contajul Contabilidade Contagem",
                  snippet: "Escritório contábil",
                },
                {
                  link: "https://instagram.com/contajul/",
                  title: "Contajul Instagram",
                  snippet: "TNA lubrificação parceiro",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("contajul.com");
    input.establishment.email = "processos@contajul.com";
    input.company.razao_social = "TNA LUBRIFICACAO E LIMPEZA AUTOMOTIVA LTDA";
    input.establishment.nome_fantasia = "TNA Lubrificacao";
    input.municipioNome = "Contagem";
    const { row } = await enrichCompany(
      input,
      { domain: "contajul.com", status: "nao_confirmado" },
      undefined,
      { emailShared: true },
    );
    expect(row.domain).toBeNull();
    expect(row.domain_status).toBe("nao_encontrado");
    expect(row.discarded_domains).toContain("contajul.com");
    expect(row.socials.instagram).toBeUndefined();
    delete process.env.SERPER_API_KEY;
  });

  it("flushes progress so a slow home upsert cannot land after complete", async () => {
    const domain = "sol-progress.test";
    mockSiteFetch({
      "/": `<html><body>Solaris CNPJ ${CNPJ}</body></html>`,
      "/contato": "<html><body>contato</body></html>",
    });
    const stages: Array<string | undefined> = [];
    let releaseHome!: () => void;
    const homeHold = new Promise<void>((resolve) => {
      releaseHome = resolve;
    });
    const done = enrichCompany(
      companyInput(domain),
      { domain, status: "nao_confirmado" },
      async (row) => {
        stages.push(row.stage);
        if (row.stage === "home") await homeHold;
      },
    );
    await vi.waitFor(() => expect(stages).toContain("home"));
    expect(stages.at(-1)).not.toBe("complete");
    releaseHome();
    const { row } = await done;
    expect(row.stage).toBe("complete");
    expect(stages.at(-1)).toBe("complete");
  });
});
