import { afterEach, describe, expect, it, vi } from "vitest";
import {
  domainFromEmail,
  enrichCompany,
  rememberStorefrontStatus,
  swapWwwOrigin,
  type CascadeCompany,
} from "./cascade";
import { DOMAIN_DISCOVERY_VERSION } from "./discovery";
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

  it("seeds a shared branded host (franchise / group mailbox)", () => {
    expect(
      domainFromEmail("contato@colegiogenesis.com.br", {
        razaoSocial: "Genesis Sociedade de Ensino Ltda",
        nomeFantasia: "Genesis",
        municipio: "Belo Horizonte",
        emailShared: true,
      }),
    ).toBe("colegiogenesis.com.br");
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

describe("rememberStorefrontStatus", () => {
  it("keeps a usable home status when harvest returns 404", () => {
    expect(
      rememberStorefrontStatus(200, { html: "not found", status: 404 }),
    ).toBe(200);
  });

  it("records the first 4xx when nothing has opened yet", () => {
    expect(
      rememberStorefrontStatus(null, { html: "Forbidden", status: 403 }),
    ).toBe(403);
  });

  it("upgrades a 4xx once a later page is usable", () => {
    expect(
      rememberStorefrontStatus(403, {
        html: "<html><body>Solaris</body></html>",
        status: 200,
      }),
    ).toBe(200);
  });
});

describe("swapWwwOrigin", () => {
  it("toggles www on https origins", () => {
    expect(swapWwwOrigin("https://faseimoveis.com.br")).toBe(
      "https://www.faseimoveis.com.br",
    );
    expect(swapWwwOrigin("https://www.faseimoveis.com.br")).toBe(
      "https://faseimoveis.com.br",
    );
  });

  it("returns null for localhost and IPv4", () => {
    expect(swapWwwOrigin("https://localhost")).toBeNull();
    expect(swapWwwOrigin("https://127.0.0.1")).toBeNull();
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

  it("keeps home http_status 200 when harvest paths like /contato return 404", async () => {
    const domain = "paprika-home.test";
    mockSiteFetch({
      "/": `<html><body>Solaris CNPJ ${CNPJ}</body></html>`,
    });

    const { row } = await enrichCompany(companyInput(domain), {
      domain,
      status: "nao_confirmado",
    });

    expect(row.domain_status).toBe("confirmado");
    expect(row.http_status).toBe(200);
  });

  it("falls back to www when the apex host refuses the home fetch", async () => {
    const domain = "sol-www.test";
    const requested: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        requested.push(href);
        if (href.startsWith(OSM_OVERPASS_URL)) {
          return new Response(JSON.stringify({ elements: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (href.includes("google.serper.dev")) {
          return new Response(JSON.stringify({ organic: [], places: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        const url = new URL(href);
        if (!url.hostname.startsWith("www.")) {
          throw new Error("apex blocked");
        }
        if (href.endsWith("/robots.txt")) {
          return new Response("User-agent: *\nAllow: /\n", { status: 200 });
        }
        if (url.pathname === "/" || url.pathname === "") {
          return htmlResponse(`<html><body>Solaris CNPJ ${CNPJ}</body></html>`);
        }
        return htmlResponse("ok");
      }),
    );

    const { row } = await enrichCompany(companyInput(domain), {
      domain,
      status: "nao_confirmado",
    });

    expect(row.domain_status).toBe("confirmado");
    expect(row.http_status).toBe(200);
    expect(requested.some((u) => u.startsWith("https://www.sol-www.test"))).toBe(
      true,
    );
  });

  it("starts at /home from a Serper hit when that is the live storefront", async () => {
    process.env.SERPER_API_KEY = "test";
    const requested: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        requested.push(href);
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
                  link: "https://www.solaris-web.com.br/home/",
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
        const url = new URL(href);
        if (!url.hostname.includes("solaris-web.com.br")) {
          return htmlResponse("not found", 404);
        }
        if (url.pathname === "/" || url.pathname === "") {
          return htmlResponse("error", 500);
        }
        if (url.pathname === "/home" || url.pathname === "/home/") {
          return htmlResponse(`<html><body>Solaris CNPJ ${CNPJ}</body></html>`);
        }
        return htmlResponse("ok");
      }),
    );
    const input = companyInput("unused.test");
    input.establishment.email = null;
    const { row } = await enrichCompany(input);
    expect(row.domain).toBe("solaris-web.com.br");
    expect(row.homepage_path).toBe("/home");
    expect(row.fonte.domain?.fonte).toBe("serper");
    expect(row.fonte.domain?.path).toBe("/home");
    expect(row.domain_status).toBe("confirmado");
    const sitePaths = requested
      .filter((u) => u.includes("solaris-web.com.br") && !u.endsWith("/robots.txt"))
      .map((u) => new URL(u).pathname);
    expect(sitePaths[0]).toBe("/home");
    delete process.env.SERPER_API_KEY;
  });

  it("keeps http_status null when every host fetch fails", async () => {
    const domain = "sol-unreachable.test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input);
        if (href.startsWith(OSM_OVERPASS_URL) || href.includes("google.serper.dev")) {
          return new Response(JSON.stringify({ organic: [], places: [], elements: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        throw new Error("unreachable");
      }),
    );

    const { row } = await enrichCompany(companyInput(domain), {
      domain,
      status: "nao_confirmado",
    });

    expect(row.domain).toBe(domain);
    expect(row.domain_status).toBe("nao_confirmado");
    expect(row.http_status).toBeNull();
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
    expect(row.gmb?.card?.filled).toEqual(expect.arrayContaining(["phone"]));
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

  it("skips school directories and confirms the branded host", async () => {
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
                  link: "https://escolasbrasil.org/minas-gerais/belo-horizonte/31007196",
                  title: "Colegio Santa Doroteia — Belo Horizonte/MG",
                  snippet: "Colégio Santa Doroteia",
                },
                {
                  link: "https://santadoroteiabh.com.br/",
                  title: "Colégio Santa Dorotéia de Belo Horizonte",
                  snippet: "Congregação de Santa Doroteia",
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
        if (href.includes("santadoroteiabh.com.br")) {
          return htmlResponse(
            `<html><body>Colégio Santa Dorotéia CNPJ ${CNPJ}</body></html>`,
          );
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("unused.test");
    input.establishment.email = null;
    input.establishment.nome_fantasia = "COLEGIO SANTA DOROTEIA";
    input.company.razao_social =
      "CONGREGACAO DE SANTA DOROTEIA DO BRASIL - SUL";
    const { row } = await enrichCompany(input);
    expect(row.domain).toBe("santadoroteiabh.com.br");
    expect(row.domain_status).toBe("confirmado");
    expect(row.fonte.discovery?.fonte).toBe(DOMAIN_DISCOVERY_VERSION);
    delete process.env.SERPER_API_KEY;
  });

  it("runs an unquoted site query when quoted search only hits directories", async () => {
    process.env.SERPER_API_KEY = "test";
    const serperBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const href = String(input);
        if (href.includes("google.serper.dev/search")) {
          const body = String(init?.body ?? "");
          serperBodies.push(body);
          if (body.includes(" MG site")) {
            return new Response(
              JSON.stringify({
                organic: [
                  {
                    link: "https://santadoroteiabh.com.br/",
                    title: "Colégio Santa Dorotéia de Belo Horizonte",
                    snippet: "Site oficial",
                  },
                ],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
          return new Response(
            JSON.stringify({
              organic: [
                {
                  link: "https://escolasbrasil.org/colegio-santa-doroteia",
                  title: "Colegio Santa Doroteia",
                  snippet: "Lista de escolas",
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
        if (href.includes("santadoroteiabh.com.br")) {
          return htmlResponse(
            `<html><body>Colégio Santa Dorotéia CNPJ ${CNPJ}</body></html>`,
          );
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("unused.test");
    input.establishment.email = null;
    input.establishment.nome_fantasia = "COLEGIO SANTA DOROTEIA";
    input.company.razao_social =
      "CONGREGACAO DE SANTA DOROTEIA DO BRASIL - SUL";
    const { row } = await enrichCompany(input);
    expect(serperBodies.some((body) => body.includes(" MG site"))).toBe(true);
    expect(row.domain).toBe("santadoroteiabh.com.br");
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

  it("seeds Delpra from Maps when the Receita phone is the accountant's", async () => {
    process.env.SERPER_API_KEY = "test";
    const mapsQueries: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const href = String(input);
        if (href.includes("google.serper.dev/maps")) {
          try {
            mapsQueries.push(
              ((JSON.parse(String(init?.body ?? "")) as { q?: string }).q ?? ""),
            );
          } catch {
            mapsQueries.push("");
          }
          return new Response(
            JSON.stringify({
              places: [
                {
                  title: "Escritório Contábil Centro",
                  address: "Rua do Contador, 10 - Uberaba - MG",
                  phoneNumber: "(34) 3312-3659",
                },
                {
                  title: "Delpra Pré-Moldados",
                  address:
                    "R. Clara Alves de Mello, 461 - Laranjeiras, Uberaba - MG",
                  website: "https://delpra.net.br",
                  phoneNumber: "(34) 99912-2128",
                  rating: 5,
                  ratingCount: 49,
                  thumbnailUrl: "https://example.com/photo.jpg",
                  openingHours: ["Thursday: 8AM-6PM"],
                  category: "Fornecedor de Pré-Moldados",
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
        if (href.includes("delpra.net.br")) {
          return htmlResponse(
            `<html><body>Delpra Pré-Moldados Tel: (34) 99912-2128 CNPJ ${CNPJ}</body></html>`,
          );
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("unused.test");
    input.establishment.email = null;
    input.establishment.nome_fantasia = "Delpra Pré-Moldados";
    input.company.razao_social = "DELPRA PRE MOLDADOS LTDA";
    input.municipioNome = "Uberaba";
    input.establishment.uf = "MG";
    input.establishment.logradouro = "Rua do Contador";
    input.establishment.numero = "10";
    input.establishment.ddd1 = "34";
    input.establishment.telefone1 = "33123659";
    input.sharedVerdict = "contabilidade";
    input.sharedCount = 150;

    const { row } = await enrichCompany(input);
    expect(mapsQueries[0]).toBe('"Delpra Pré-Moldados" Uberaba MG');
    expect(mapsQueries.every((q) => !/contador/i.test(q))).toBe(true);
    expect(row.gmb?.matched).toBe(true);
    expect(row.gmb?.match_by).toEqual(expect.arrayContaining(["title", "city"]));
    expect(row.gmb?.card?.ratingCount).toBe(49);
    expect(row.domain).toBe("delpra.net.br");
    expect(row.fonte.domain?.fonte).toBe("gmb");
    expect(row.domain_status).toBe("confirmado");
    const mobile = row.phones.find((p) => p.e164.includes("999122128"));
    expect(mobile?.seal).toBe("ATUALIZADO");
    expect(mobile?.sources.some((s) => s.startsWith("site"))).toBe(true);
    expect(row.phones.every((p) => !p.sources.includes("gmb" as never))).toBe(
      true,
    );
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

  it("seeds a shared branded franchise e-mail even if a prior run discarded the host", async () => {
    mockSiteFetch({
      "/": "<html><body>Lavanderia 60 Minutos — franquia nacional</body></html>",
      "/contato": "<html><body>contato</body></html>",
    });
    const input = companyInput("lavanderia60minutos.com.br");
    input.establishment.email = "atendimento@lavanderia60minutos.com.br";
    input.establishment.nome_fantasia = "Lavanderia 60 Minutos";
    input.company.razao_social = "LAVANDERIA 60 MINUTOS BH LTDA";
    const { row } = await enrichCompany(input, null, undefined, {
      emailShared: true,
      discardedDomains: ["lavanderia60minutos.com.br"],
    });
    expect(row.domain).toBe("lavanderia60minutos.com.br");
    expect(row.fonte.domain?.fonte).toBe("email_receita");
    expect(row.discarded_domains).not.toContain("lavanderia60minutos.com.br");
  });

  it("finds a national franchise site when regional Serper misses", async () => {
    process.env.SERPER_API_KEY = "test";
    const queries: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const href = String(input);
        if (href.includes("google.serper.dev/maps")) {
          return new Response(JSON.stringify({ places: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (href.includes("google.serper.dev/search")) {
          const raw =
            typeof init?.body === "string"
              ? init.body
              : "";
          let q = "";
          try {
            q = (JSON.parse(raw) as { q?: string }).q ?? "";
          } catch {
            q = "";
          }
          queries.push(q);
          const regional = /Belo Horizonte|\bMG\b/i.test(q);
          return new Response(
            JSON.stringify({
              organic: regional
                ? []
                : [
                    {
                      link: "https://www.lavanderia60minutos.com.br/",
                      title: "Lavanderia 60 Minutos",
                      snippet: "Franquia nacional de lavanderia express",
                    },
                  ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (href.endsWith("/robots.txt")) {
          return new Response("User-agent: *\nAllow: /\n", { status: 200 });
        }
        if (href.includes("lavanderia60minutos.com.br")) {
          return htmlResponse(
            "<html><body>Lavanderia 60 Minutos franquia</body></html>",
          );
        }
        if (href.startsWith(OSM_OVERPASS_URL)) {
          return new Response(JSON.stringify({ elements: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return htmlResponse("not found", 404);
      }),
    );
    const input = companyInput("gmail.com");
    input.establishment.email = "atendimento@gmail.com";
    input.establishment.nome_fantasia = "Lavanderia 60 Minutos";
    input.company.razao_social = "LAVANDERIA 60 MINUTOS BH LTDA";
    const { row } = await enrichCompany(input);
    expect(queries.some((q) => /Belo Horizonte/.test(q))).toBe(true);
    expect(queries).toContain('"Lavanderia 60 Minutos"');
    expect(row.domain).toBe("lavanderia60minutos.com.br");
    expect(row.fonte.domain?.fonte).toBe("serper");
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
