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
      | "onboarding_completed_at"
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
    onboarding_completed_at: null,
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

function finishedHelmet() {
  return {
    ...helmet(),
    promessa: "gerar demanda",
    onboarding_completed_at: "2026-08-19T12:00:00.000Z",
  };
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
    expect(slots.map((s) => s.id)).toEqual([
      "capacete",
      "oferta",
      "meta",
      "lista",
      "crm",
      "ligar",
      "creditos",
    ]);
    expect(nextGap).toBe("capacete");
    expect(pistaAberta).toBe(false);
    expect(slots.find((s) => s.id === "lista")?.cta).toBe(COPY.novaLista);
    expect(slots.find((s) => s.id === "lista")?.href).toBe(largadaNovaHref);
    expect(slots.find((s) => s.id === "creditos")?.label).toBe("Acesso");
  });

  it("opens oferta after capacete is ready", () => {
    const { nextGap } = buildBoxEstrutura({
      savedCount: 0,
      hasUnsavedSearch: false,
      profile: helmet(),
      billing: { total: 25, plano: "free" },
      connections: [],
    });
    expect(nextGap).toBe("oferta");
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

  it("lights capacete from identity and oferta from the promise", () => {
    const empty = slotMap();
    expect(empty.byId.capacete.done).toBe(false);
    expect(empty.byId.oferta.done).toBe(false);
    expect(empty.byId.meta.done).toBe(false);

    const identity = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: { ...helmet(), promessa: "gerar demanda" },
      billing: { total: 25, plano: "free" },
      connections: [],
    });
    expect(identity.byId.capacete.done).toBe(true);
    expect(identity.byId.oferta.done).toBe(true);
    expect(identity.byId.meta.done).toBe(false);
    expect(identity.nextGap).toBe("meta");
  });

  it("lights capacete and meta when onboarding is finished", () => {
    const skipped = slotMap({
      savedCount: 0,
      hasUnsavedSearch: false,
      profile: profile({ onboarding_completed_at: "2026-08-19T12:00:00.000Z" }),
      billing: { total: 25, plano: "free" },
      connections: [],
    });
    expect(skipped.byId.capacete.done).toBe(true);
    expect(skipped.byId.oferta.done).toBe(false);
    expect(skipped.byId.meta.done).toBe(true);
    expect(skipped.nextGap).toBe("oferta");

    const finished = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: finishedHelmet(),
      billing: { total: 25, plano: "free" },
      connections: [],
    });
    expect(finished.byId.capacete.done).toBe(true);
    expect(finished.byId.oferta.done).toBe(true);
    expect(finished.byId.meta.done).toBe(true);
    expect(finished.byId.lista.done).toBe(true);
    expect(finished.nextGap).toBe("crm");
  });

  it("treats meta as a gap until onboarding is finished", () => {
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

    const native = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: helmet(),
      billing: { total: 25, plano: "free" },
      connections: [conn({ id: "a", kind: "voip", provider: "api4com" })],
    });
    expect(native.byId.ligar.done).toBe(true);

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
    expect(crmOnly.byId.crm.done).toBe(false);
    expect(crmOnly.byId.ligar.href).toBe(conexoesHref("voip"));
    expect(crmOnly.byId.crm.href).toBe("/crm");

    const nativeCrm = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: helmet(),
      billing: { total: 25, plano: "free" },
      connections: [],
      hasCrmPipeline: true,
    });
    expect(nativeCrm.byId.crm.done).toBe(true);
    expect(nativeCrm.byId.crm.cta).toBe(COPY.crmBoxCta);
  });

  it("treats credits as a gap on free or zero balance", () => {
    expect(
      slotMap({
        savedCount: 1,
        hasUnsavedSearch: false,
        profile: finishedHelmet(),
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
        profile: finishedHelmet(),
        billing: { total: 0, plano: "piloto" },
        connections: [
          conn({ id: "v", kind: "voip" }),
        ],
        hasCrmPipeline: true,
      }).nextGap,
    ).toBe("creditos");
    const ready = slotMap({
      savedCount: 1,
      hasUnsavedSearch: false,
      profile: finishedHelmet(),
      billing: { total: 900, plano: "piloto" },
      connections: [
        conn({ id: "v", kind: "voip" }),
      ],
      hasCrmPipeline: true,
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
