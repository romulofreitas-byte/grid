import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConnectionCtx } from "./adapter";
import type { LeadOutbound } from "./schema";
import {
  create3cplusAdapter,
  mailingFromLead,
  normalize3cplusHost,
  parse3cplusInbound,
  probe3cplus,
} from "./3cplus-adapter";
import { inboundWebhookPath } from "./records";

const lead = {
  cnpj: "12345678000190",
  razao_social: "CLINICA EXEMPLO LTDA",
  nome_fantasia: "Clínica",
  is_matriz: true,
  porte: "03",
  capital_social: 1,
  cnae_principal: "8630503",
  cnae_descricao: "Clinica",
  address: {
    logradouro: "RUA",
    numero: "1",
    complemento: null,
    bairro: "CENTRO",
    cep: "30130010",
    municipio: "Belo Horizonte",
    uf: "MG",
  },
  phones: [
    {
      e164: "+5511988887777",
      display: "(11) 98888-7777",
      tipo: "movel",
      sources: ["receita"],
      isWhatsApp: false,
      seal: "CONFIRMADO",
    },
  ],
  email: null,
  whatsapp: null,
  domain: null,
  decisor: { nome: "Ana", qualificacao: "Sócio", data_entrada: null, faixa_etaria: null },
  grid_score: 80,
  grid_position: 1,
  status: "novo",
  search_id: "11111111-1111-4111-8111-111111111111",
  search_name: "Lista BH",
  niche_slug: null,
  segment_slugs: [],
  dossier_url: "http://localhost:3000/lead/12345678000190",
  osm_matched: false,
  golden_minute: null,
  fonte: {},
} as LeadOutbound;

function ctx(): ConnectionCtx {
  return {
    connectionId: "22222222-2222-4222-8222-222222222222",
    userId: "00000000-0000-4000-8000-000000000001",
    provider: "3cplus",
    kind: "dialer",
    config: {
      catalog_id: "3cplus",
      domain: "empresa.3c.plus",
      campaign_id: "9",
    },
    callerId: "1001",
    decryptCredentials: async () => ({
      api_token: "gestor-token",
      agent_token: "agente-token",
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalize3cplusHost", () => {
  it("strips protocol and rejects loopback", () => {
    expect(normalize3cplusHost("https://Empresa.3c.plus/app")).toBe("empresa.3c.plus");
    expect(normalize3cplusHost("localhost")).toBeNull();
  });
});

describe("inbound webhook path", () => {
  it("routes 3C Plus to the dialer inbound URL", () => {
    expect(inboundWebhookPath("abc", "3cplus", "3cplus")).toBe(
      "/api/webhooks/dialer/3cplus/abc",
    );
  });
});

describe("mailingFromLead", () => {
  it("uses CNPJ as identifier and BR digits without +55", () => {
    const row = mailingFromLead(lead);
    expect(row?.identifier).toBe("12345678000190");
    expect(row?.phone).toBe("11988887777");
    expect(row?.data.cnpj).toBe("12345678000190");
    expect(JSON.stringify(row)).not.toMatch(/cpf/i);
  });
});

describe("probe3cplus", () => {
  it("lists campaigns with api_token", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      expect(String(url)).toContain("empresa.3c.plus/api/v1/campaigns");
      expect(String(url)).toContain("api_token=gestor-token");
      return new Response(JSON.stringify({ data: [{ id: 9, name: "Outbound" }] }), {
        status: 200,
      });
    });
    const probed = await probe3cplus("empresa.3c.plus", "gestor-token");
    expect(probed.ok).toBe(true);
    if (probed.ok) {
      expect(probed.campaigns).toEqual([{ id: "9", name: "Outbound" }]);
    }
  });
});

describe("create3cplusAdapter", () => {
  it("creates a list, posts mailing.json and updates weight", async () => {
    const calls: Array<{ url: string; method: string; body: string }> = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: String(init?.method ?? "GET"),
        body: String(init?.body ?? ""),
      });
      if (String(url).includes("/lists") && init?.method === "POST" && !String(url).includes("mailing")) {
        return new Response(JSON.stringify({ id: 44 }), { status: 200 });
      }
      return new Response(null, { status: 204 });
    });
    const result = await create3cplusAdapter().pushList!([lead], ctx());
    expect(result.accepted).toBe(1);
    expect(calls.some((c) => c.method === "POST" && c.url.includes("/lists") && !c.url.includes("mailing"))).toBe(true);
    expect(calls.some((c) => c.url.includes("/mailing.json"))).toBe(true);
    expect(calls.some((c) => c.method === "PUT" && c.url.includes("updateWeight"))).toBe(true);
    const mailing = calls.find((c) => c.url.includes("/mailing.json"));
    expect(mailing?.body).toContain("12345678000190");
    expect(mailing?.body).toContain("11988887777");
  });

  it("dials with the agent token", async () => {
    let captured = "";
    let auth = "";
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      captured = String(init?.body ?? "");
      auth = String(url);
      return new Response(JSON.stringify({ call: { id: "c1" } }), { status: 200 });
    });
    const result = await create3cplusAdapter().originate!(
      {
        toE164: "+5511988887777",
        from: "1001",
        cnpj: "12345678000190",
        searchId: lead.search_id,
      },
      ctx(),
    );
    expect(result.accepted).toBe(true);
    expect(result.externalId).toBe("c1");
    expect(auth).toContain("agent/manual_call/dial");
    expect(auth).toContain("api_token=agente-token");
    expect(captured).toContain("phone=11988887777");
  });
});

describe("parse3cplusInbound", () => {
  it("reads CNPJ identifier and qualification name", () => {
    const parsed = parse3cplusInbound(
      JSON.stringify({
        mailing: { identifier: "12345678000190", data: { name: "Clínica" } },
        qualification: { name: "reuniao" },
        call: { id: "c9", duration: 30 },
      }),
    );
    expect(parsed?.cnpj).toBe("12345678000190");
    expect(parsed?.disposition).toBe("reuniao");
    expect(parsed?.externalId).toBe("c9");
    expect(parsed?.durationSec).toBe(30);
  });
});
