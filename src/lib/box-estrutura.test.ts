import { describe, expect, it } from "vitest";
import { conexoesHref, largadaNovaHref } from "@/lib/back";
import { COPY } from "@/lib/copy";
import type { CallConnectionPick } from "@/lib/integrations/call-target";
import type { Profile } from "@/lib/types";
import { BOX_SLOT_IDS, buildBoxEstrutura } from "./box-estrutura";

function profile(
  over: Partial<
    Pick<
      Profile,
      | "como_chama"
      | "nome"
      | "empresa_usuario"
      | "cidade_usuario"
      | "especialidade"
      | "area"
      | "promessa"
    >
  > = {},
) {
  return {
    como_chama: null,
    nome: null,
    empresa_usuario: null,
    cidade_usuario: null,
    especialidade: null,
    area: null,
    promessa: null,
    ...over,
  };
}

function helmet() {
  return profile({
    como_chama: "Rômulo",
    empresa_usuario: "Combustível",
    cidade_usuario: "BH",
    especialidade: "marketing digital",
    area: "vendas",
  });
}

function conn(
  partial: Partial<CallConnectionPick> & Pick<CallConnectionPick, "id" | "kind">,
): CallConnectionPick {
  return {
    status: "active",
    provider: "webhook",
    display_name: partial.kind,
    catalog_id: null,
    caller_id: null,
    ...partial,
  };
}

function slotMap(
  input: Parameters<typeof buildBoxEstrutura>[0] = {
    savedCount: 0,
    hasUnsavedSearch: false,
    profile: profile(),
    billing: { total: 25, plano: "free" },
    connections: [],
  },
) {
  const result = buildBoxEstrutura(input);
  return {
    ...result,
    byId: Object.fromEntries(result.slots.map((s) => [s.id, s])),
  };
}

describe("buildBoxEstrutura", () => {
  it("keeps the seven lights in gate order and opens capacete first", () => {
    const { slots, nextGap, pistaAberta } = buildBoxEstrutura({
      savedCount: 0,
      hasUnsavedSearch: false,
      profile: profile(),
      billing: { total: 25, plano: "free" },
      connections: [],
    });
    expect(slots.map((s) => s.id)).toEqual([...BOX_SLOT_IDS]);
    expect(nextGap).toBe("capacete");
    expect(pistaAberta).toBe(false);
    expect(slots.find((s) => s.id === "lista")?.cta).toBe(COPY.novaLista);
    expect(slots.find((s) => s.id === "lista")?.href).toBe(largadaNovaHref);
  });

  it("opens lista after capacete is ready", () => {
    const { nextGap } = buildBoxEstrutura({
      savedCount: 0,
      hasUnsavedSearch: false,
      profile: helmet(),
      billing: { total: 25, plano: "free" },
      connections: [],
    });
    expect(nextGap).toBe("lista");
  });

  it("opens the pista only with a saved list", () => {
    expect(
      buildBoxEstrutura({
        savedCount: 0,
        hasUnsavedSearch: true,
        profile: helmet(),
        billing: { total: 25, plano: "free" },
        connections: [],
      }).pistaAberta,
    ).toBe(false);
    const open = buildBoxEstrutura({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: helmet(),
      billing: { total: 25, plano: "free" },
      connections: [],
    });
    expect(open.pistaAberta).toBe(true);
    expect(open.slots.find((s) => s.id === "lista")?.done).toBe(true);
  });

  it("asks to save when an unsaved search exists", () => {
    const { byId } = slotMap({
      savedCount: 0,
      hasUnsavedSearch: true,
      profile: profile(),
      billing: { total: 0, plano: "free" },
      connections: [],
    });
    expect(byId.lista.cta).toBe(COPY.salvarLista);
  });

  it("lights capacete, oferta and meta from the helmet and promise", () => {
    const empty = slotMap();
    expect(empty.byId.capacete.done).toBe(false);
    expect(empty.byId.oferta.done).toBe(false);
    expect(empty.byId.meta.done).toBe(false);

    const ready = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: { ...helmet(), promessa: "gerar demanda" },
      billing: { total: 25, plano: "free" },
      connections: [],
    });
    expect(ready.byId.capacete.done).toBe(true);
    expect(ready.byId.oferta.done).toBe(true);
    expect(ready.byId.meta.done).toBe(true);
    expect(ready.nextGap).toBe("ligar");
  });

  it("treats meta as a gap until the helmet is ready", () => {
    const { byId, nextGap } = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: profile({ promessa: "gerar demanda" }),
      billing: { total: 900, plano: "piloto" },
      connections: [],
    });
    expect(byId.capacete.done).toBe(false);
    expect(byId.oferta.done).toBe(true);
    expect(byId.meta.done).toBe(false);
    expect(nextGap).toBe("capacete");
  });

  it("lights Ligar from VoIP, discador or webhook — never CRM", () => {
    const voip = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: helmet(),
      billing: { total: 25, plano: "free" },
      connections: [conn({ id: "v", kind: "voip" })],
    });
    expect(voip.byId.ligar.done).toBe(true);
    expect(voip.byId.crm.done).toBe(false);

    const dialer = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: helmet(),
      billing: { total: 25, plano: "free" },
      connections: [conn({ id: "d", kind: "dialer" })],
    });
    expect(dialer.byId.ligar.done).toBe(true);

    const crmOnly = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: helmet(),
      billing: { total: 25, plano: "free" },
      connections: [conn({ id: "c", kind: "crm" })],
    });
    expect(crmOnly.byId.ligar.done).toBe(false);
    expect(crmOnly.byId.crm.done).toBe(true);
    expect(crmOnly.byId.ligar.href).toBe(conexoesHref("voip"));
    expect(crmOnly.byId.crm.href).toBe(conexoesHref("crm"));
  });

  it("treats credits as a gap on free or zero balance", () => {
    expect(
      slotMap({
        savedCount: 1,
        hasUnsavedSearch: false,
        profile: { ...helmet(), promessa: "x" },
        billing: { total: 25, plano: "free" },
        connections: [
          conn({ id: "v", kind: "voip" }),
          conn({ id: "c", kind: "crm" }),
        ],
      }).byId.creditos.done,
    ).toBe(false);
    expect(
      slotMap({
        savedCount: 1,
        hasUnsavedSearch: false,
        profile: { ...helmet(), promessa: "x" },
        billing: { total: 0, plano: "piloto" },
        connections: [
          conn({ id: "v", kind: "voip" }),
          conn({ id: "c", kind: "crm" }),
        ],
      }).nextGap,
    ).toBe("creditos");
    const ready = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: { ...helmet(), promessa: "x" },
      billing: { total: 900, plano: "piloto" },
      connections: [
        conn({ id: "v", kind: "voip" }),
        conn({ id: "c", kind: "crm" }),
      ],
    });
    expect(ready.nextGap).toBeNull();
    expect(ready.slots.every((s) => s.done)).toBe(true);
  });

  it("deep-links oferta and meta to conta anchors", () => {
    const { byId } = slotMap({
      savedCount: 0,
      hasUnsavedSearch: false,
      profile: profile(),
      billing: { total: 25, plano: "free" },
      connections: [],
    });
    expect(byId.oferta.href).toBe("/conta#promessa");
    expect(byId.meta.href).toBe("/conta#meta");
  });
});
