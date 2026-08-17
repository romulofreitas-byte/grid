import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebhookAdapter } from "./webhook-adapter";
import { verifyGridWebhook } from "./hmac";
import type { ConnectionCtx } from "./adapter";
import type { LeadOutbound } from "./schema";

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
  phones: [],
  email: null,
  whatsapp: null,
  domain: null,
  decisor: { nome: "Ana", qualificacao: "Sócio", data_entrada: null, faixa_etaria: null },
  grid_score: 80,
  grid_position: 1,
  status: "novo",
  search_id: "11111111-1111-4111-8111-111111111111",
  search_name: "Lista",
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
    provider: "webhook",
    kind: "webhook",
    config: { webhook_url: "https://hooks.example.com/grid", search_id: lead.search_id },
    callerId: "1001",
    decryptCredentials: async () => ({
      hmac_secret: "secret-hex",
      webhook_url: "https://hooks.example.com/grid",
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createWebhookAdapter", () => {
  it("POSTs a signed list.exported payload", async () => {
    let captured: { body: string; headers: Headers } | null = null;
    vi.stubGlobal(
      "fetch",
      async (_url: string, init?: RequestInit) => {
        captured = {
          body: String(init?.body ?? ""),
          headers: new Headers(init?.headers),
        };
        return new Response("ok", { status: 200 });
      },
    );
    const adapter = createWebhookAdapter();
    const result = await adapter.pushList!([lead], ctx());
    expect(result.accepted).toBe(1);
    expect(captured).not.toBeNull();
    const json = JSON.parse(captured!.body) as { event: string; leads: LeadOutbound[] };
    expect(json.event).toBe("list.exported");
    expect(json.leads[0]?.cnpj).toBe(lead.cnpj);
    const verified = verifyGridWebhook({
      secret: "secret-hex",
      rawBody: captured!.body,
      signatureHeader: captured!.headers.get("x-grid-signature"),
      timestampHeader: captured!.headers.get("x-grid-timestamp"),
    });
    expect(verified.ok).toBe(true);
  });
});
