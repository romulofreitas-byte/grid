import { describe, expect, it } from "vitest";
import { callStreak, saoPauloDay, uniqueCallDays } from "./call-stats";
import {
  cargoChoice,
  cargoLabel,
  CARGO_GROUPS,
  CARGO_OPTIONS,
  hasScriptIdentity,
  hasSetupIdentity,
  marketChoice,
  marketLabel,
  MARKET_OPTIONS,
  needsHelmetSetup,
  profileIdentityStatus,
  profileReadiness,
  setupEcho,
} from "./pilot-profile";
import type { Profile } from "./types";

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    nome: null,
    plano: "free",
    creditos: 25,
    especialidade: null,
    cargo: null,
    area: null,
    empresa_usuario: null,
    cidade_usuario: null,
    documento: null,
    documento_tipo: null,
    foto_url: null,
    como_chama: null,
    tratamento: null,
    promessa: null,
    duracao_reuniao: 20,
    meta_ligacoes_dia: 20,
    active_meta_id: null,
    onboarding_completed_at: null,
    created_at: "2026-01-01T12:00:00.000Z",
    ...over,
  };
}

describe("saoPauloDay", () => {
  it("keeps noon UTC on the same civil day", () => {
    expect(saoPauloDay("2026-08-16T15:00:00.000Z")).toBe("2026-08-16");
  });

  it("rolls back before midnight in São Paulo", () => {
    expect(saoPauloDay("2026-08-16T02:00:00.000Z")).toBe("2026-08-15");
  });
});

describe("callStreak", () => {
  const now = new Date("2026-08-16T15:00:00.000Z");

  it("is zero without calls", () => {
    expect(callStreak([], now)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(
      callStreak(
        [
          "2026-08-16T15:00:00.000Z",
          "2026-08-15T15:00:00.000Z",
          "2026-08-14T15:00:00.000Z",
        ],
        now,
      ),
    ).toBe(3);
  });

  it("stays alive if today is empty but yesterday has a call", () => {
    expect(callStreak(["2026-08-15T15:00:00.000Z"], now)).toBe(1);
  });

  it("resets after a missed civil day", () => {
    expect(callStreak(["2026-08-14T15:00:00.000Z"], now)).toBe(0);
  });

  it("dedupes two calls on the same day", () => {
    expect(
      uniqueCallDays([
        "2026-08-16T12:00:00.000Z",
        "2026-08-16T18:00:00.000Z",
      ]),
    ).toEqual(["2026-08-16"]);
    expect(
      callStreak(
        ["2026-08-16T12:00:00.000Z", "2026-08-16T18:00:00.000Z"],
        now,
      ),
    ).toBe(1);
  });
});

describe("profileReadiness", () => {
  it("is 0 for an empty helmet", () => {
    expect(profileReadiness(profile())).toBe(0);
    expect(hasScriptIdentity(profile())).toBe(false);
    expect(hasSetupIdentity(profile())).toBe(false);
    expect(needsHelmetSetup(profile())).toBe(true);
  });

  it("treats setup identity as name, market and role — not the call script", () => {
    const identity = profile({
      como_chama: "Rômulo",
      especialidade: "marketing digital",
      cargo: "diretor",
    });
    expect(hasSetupIdentity(identity)).toBe(true);
    expect(hasScriptIdentity(identity)).toBe(false);
    expect(needsHelmetSetup(identity)).toBe(true);
    expect(profileReadiness(identity)).toBe(75);
    expect(profileIdentityStatus(identity)).toBe(
      "Nome, mercado e cargo preenchidos.",
    );
  });

  it("does not accept Outro without a typed role", () => {
    expect(
      hasSetupIdentity(
        profile({
          como_chama: "Rômulo",
          especialidade: "clínicas",
          cargo: "outro",
        }),
      ),
    ).toBe(false);
    expect(
      hasSetupIdentity(
        profile({
          como_chama: "Rômulo",
          especialidade: "clínicas",
          cargo: "Closer",
        }),
      ),
    ).toBe(true);
  });

  it("does not accept Outro without a typed market", () => {
    expect(
      hasSetupIdentity(
        profile({
          como_chama: "Rômulo",
          especialidade: "outro",
          cargo: "sdr",
        }),
      ),
    ).toBe(false);
  });

  it("reaches 100 when presentation slots are filled", () => {
    const full = profile({
      nome: "Rômulo Freitas",
      como_chama: "Rômulo",
      especialidade: "marketing digital",
      cargo: "diretor",
      foto_url: "data:image/jpeg;base64,xx",
      onboarding_completed_at: "2026-08-16T12:00:00.000Z",
    });
    expect(profileReadiness(full)).toBe(100);
    expect(hasSetupIdentity(full)).toBe(true);
    expect(needsHelmetSetup(full)).toBe(false);
  });

  it("does not gate after onboarding even if fields are empty", () => {
    expect(
      needsHelmetSetup(
        profile({ onboarding_completed_at: "2026-08-16T12:00:00.000Z" }),
      ),
    ).toBe(false);
  });
});

describe("profile catalogs", () => {
  it("keeps stable market and cargo ids for ops", () => {
    expect(MARKET_OPTIONS.map((option) => option.id)).toEqual([
      "marketing",
      "seguros",
      "plano_saude",
      "consorcio",
      "assessoria_investimentos",
      "contabilidade",
      "b2b_servicos",
      "imobiliario",
      "software",
      "educacao",
      "energia_solar",
      "outro",
    ]);
    expect(CARGO_OPTIONS.map((option) => option.id)).toContain("bdr");
    expect(CARGO_OPTIONS.map((option) => option.id)).toContain(
      "diretor_comercial",
    );
    expect(CARGO_OPTIONS.map((option) => option.id)).toContain("corretor");
    expect(
      CARGO_GROUPS.find((group) => group.id === "especialistas")?.options.map(
        (option) => option.id,
      ),
    ).toEqual(["assessor_investimentos", "consorcio", "franquia"]);
    expect(
      CARGO_GROUPS.find((group) => group.id === "outro")?.options.map(
        (option) => option.id,
      ),
    ).toEqual(["outro"]);
  });

  it("maps legacy cargo ids to the new catalog", () => {
    expect(cargoChoice("diretor")).toBe("diretor_comercial");
    expect(cargoLabel("diretor")).toBe("Diretor comercial");
    expect(cargoChoice("gestor")).toBe("gestor_comercial");
    expect(cargoLabel("Closer")).toBe("Closer");
  });

  it("labels market ids and keeps free text", () => {
    expect(marketChoice("seguros")).toBe("seguros");
    expect(marketLabel("seguros")).toBe("Seguros");
    expect(marketChoice("consorcio")).toBe("consorcio");
    expect(marketLabel("consorcio")).toBe("Consórcios");
    expect(marketChoice("clinicas")).toBe("outro");
    expect(marketLabel("clinicas")).toBe("clinicas");
    expect(marketChoice("marketing digital")).toBe("outro");
    expect(marketLabel("marketing digital")).toBe("marketing digital");
  });

  it("echoes the identity the GRID just learned", () => {
    expect(
      setupEcho({
        como_chama: "Rômulo",
        especialidade: "marketing",
        cargo: "sdr",
      }),
    ).toBe("Rômulo · SDR · Marketing");
  });
});
