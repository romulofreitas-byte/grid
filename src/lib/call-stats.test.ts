import { describe, expect, it } from "vitest";
import { callStreak, saoPauloDay, uniqueCallDays } from "./call-stats";
import {
  hasScriptIdentity,
  needsHelmetSetup,
  profileReadiness,
} from "./pilot-profile";
import type { Profile } from "./types";

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    nome: null,
    plano: "free",
    creditos: 25,
    especialidade: null,
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
    expect(needsHelmetSetup(profile())).toBe(true);
  });

  it("treats identity as name, company, city and promise — not specialty", () => {
    const identity = profile({
      como_chama: "Rômulo",
      empresa_usuario: "Combustível",
      cidade_usuario: "BH",
      promessa: "gerar demanda",
    });
    expect(hasScriptIdentity(identity)).toBe(true);
    expect(needsHelmetSetup(identity)).toBe(true);
    expect(profileReadiness(identity)).toBe(80);
  });

  it("reaches 100 when presentation slots are filled", () => {
    const full = profile({
      nome: "Rômulo Freitas",
      como_chama: "Rômulo",
      empresa_usuario: "Combustível",
      cidade_usuario: "BH",
      foto_url: "data:image/jpeg;base64,xx",
      promessa: "gerar demanda",
      onboarding_completed_at: "2026-08-16T12:00:00.000Z",
    });
    expect(profileReadiness(full)).toBe(100);
    expect(hasScriptIdentity(full)).toBe(true);
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
