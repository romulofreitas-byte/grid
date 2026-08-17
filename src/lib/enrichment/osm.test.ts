import { describe, expect, it, vi } from "vitest";
import {
  OSM_ATTRIBUTION,
  applyOsmFollowup,
  buildOverpassQuery,
  confirmWithOsm,
  enqueueOsmFollowup,
  evaluateOsm,
  extractOsmPhoneRaws,
  phonesForOsm,
  preferOsmElements,
} from "./osm";

describe("extractOsmPhoneRaws", () => {
  it("reads phone and contact:phone, splitting lists", () => {
    expect(
      extractOsmPhoneRaws({
        phone: "+55 31 3333-1111; +55 31 98888-2222",
        "contact:phone": "(31) 3222-0000",
      }),
    ).toEqual(["+55 31 3333-1111", "+55 31 98888-2222", "(31) 3222-0000"]);
  });
});

describe("evaluateOsm", () => {
  it("returns matched when OSM phone equals Receita/site", () => {
    const r = evaluateOsm(
      [{ tags: { phone: "+55 31 3333-1111" } }],
      ["+553133331111"],
      "31",
    );
    expect(r).toEqual({ matched: true, attribution: OSM_ATTRIBUTION });
  });

  it("returns matched:false when OSM has a different number", () => {
    const r = evaluateOsm(
      [{ tags: { phone: "(31) 98888-7777" } }],
      ["+553133331111"],
      "31",
    );
    expect(r).toEqual({ matched: false, attribution: OSM_ATTRIBUTION });
  });

  it("returns null when OSM has no phone tags", () => {
    expect(evaluateOsm([{ tags: { name: "Loja" } }], ["+553133331111"], "31")).toBeNull();
  });

  it("prefers the POI whose website matches the known domain", () => {
    const r = evaluateOsm(
      [
        { tags: { phone: "(31) 98888-7777", website: "https://outra.com.br" } },
        {
          tags: {
            phone: "+55 31 3333-1111",
            website: "https://www.clinica.com.br",
          },
        },
      ],
      ["+553133331111"],
      "31",
      "clinica.com.br",
    );
    expect(r?.matched).toBe(true);
  });
});

describe("preferOsmElements", () => {
  it("falls back to all elements when no website matches", () => {
    const els = [{ tags: { phone: "1" } }];
    expect(preferOsmElements(els, "x.com")).toEqual(els);
  });
});

describe("buildOverpassQuery", () => {
  it("scopes by UF and city and never asks for OSM geometry dump", () => {
    const q = buildOverpassQuery({
      razaoSocial: "Clinica Sol Ltda",
      nomeFantasia: "Clinica Sol",
      municipioNome: "Belo Horizonte",
      uf: "mg",
      logradouro: "Rua da Bahia",
      numero: "100",
    });
    expect(q).toContain('ISO3166-2"="BR-MG"');
    expect(q).toContain("Clinica Sol");
    expect(q).toContain("Belo Horizonte");
    expect(q).toContain("Rua da Bahia");
    expect(q).toContain("out tags 15");
  });
});

describe("confirmWithOsm", () => {
  it("returns null on timeout without throwing", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("Aborted");
    }) as unknown as typeof fetch;
    await expect(
      confirmWithOsm({
        razaoSocial: "Clinica Sol",
        nomeFantasia: null,
        municipioNome: "Belo Horizonte",
        uf: "MG",
        logradouro: null,
        numero: null,
        knownPhones: ["+553133331111"],
        fetchImpl,
      }),
    ).resolves.toBeNull();
  });

  it("skips Overpass when there is no known phone to confirm", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      confirmWithOsm({
        razaoSocial: "Clinica Sol",
        nomeFantasia: null,
        municipioNome: "Belo Horizonte",
        uf: "MG",
        logradouro: null,
        numero: null,
        knownPhones: [],
        fetchImpl,
      }),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("phonesForOsm", () => {
  it("ignores OSM-only numbers", () => {
    expect(
      phonesForOsm({
        phones: [
          { e164: "+553133331111", sources: ["receita"] },
          { e164: "+5531988877777", sources: ["osm"] },
        ],
      }),
    ).toEqual(["+553133331111"]);
  });
});

describe("applyOsmFollowup", () => {
  it("patches the completed row when Overpass confirms the phone", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          elements: [{ tags: { phone: "+55 31 3333-1111" } }],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const patched = await applyOsmFollowup(
      {
        cnpj: "12345678000190",
        domain: "clinica.com.br",
        domain_status: "confirmado",
        http_status: 200,
        phones: [
          {
            e164: "+553133331111",
            display: "(31) 3333-1111",
            tipo: "fixo",
            sources: ["receita"],
            isWhatsApp: false,
            seal: "NAO_CONFIRMADO",
          },
        ],
        emails: [],
        whatsapp: null,
        socials: {},
        tech: {
          metaPixel: false,
          gtm: false,
          ga4: false,
          googleAds: false,
          tiktokPixel: false,
          rdStation: false,
          hotjar: false,
          clarity: false,
          chat: null,
          plataforma: null,
          https: true,
          viewport: true,
        },
        freshness: {},
        osm: null,
        dor_digital: 0,
        contexto: [],
        fonte: {},
        midiaPaga: { label: "NÃO VERIFICADO", verificado_automaticamente: false },
        collected_at: "2026-08-17T12:00:00.000Z",
        expires_at: "2026-09-16T12:00:00.000Z",
        stage: "complete",
      },
      {
        razaoSocial: "Clinica Sol",
        nomeFantasia: null,
        municipioNome: "Belo Horizonte",
        uf: "MG",
        logradouro: null,
        numero: null,
        fallbackDdd: "31",
        fetchImpl,
      },
    );

    expect(patched?.osm).toEqual({
      matched: true,
      attribution: OSM_ATTRIBUTION,
    });
  });
});

describe("enqueueOsmFollowup", () => {
  it("runs the next Overpass call only after the current one finishes", async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = enqueueOsmFollowup(async () => {
      order.push("a-start");
      await firstGate;
      order.push("a-end");
    });
    const second = enqueueOsmFollowup(async () => {
      order.push("b");
    });

    await vi.waitFor(() => {
      expect(order).toEqual(["a-start"]);
    });
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["a-start", "a-end", "b"]);
  });
});
